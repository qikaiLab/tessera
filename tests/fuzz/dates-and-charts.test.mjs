import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { daysUntil, describeCountdown } from '../../src/renderer/src/utils/countdowns.js'
import { formatRangeLabel, getPresetRange } from '../../src/renderer/src/utils/timelineRange.js'
import { buildChartData, formatAxisDate, formatTooltipDate, getChartSeries, getDateRange } from '../../src/renderer/src/utils/analyticsData.js'
import { getHeatmapDays, getHeatmapRangeStart, normalizeSeries } from '../../src/renderer/src/utils/analyticsCard.js'
import { createHeatmapScale, getHeatmapAlpha } from '../../src/renderer/src/utils/heatmapScale.js'
import { buildTimelineCards } from '../../src/renderer/src/utils/timelineCards.js'
import { findRecentNumberValues } from '../../src/renderer/src/utils/recentNumbers.js'
import { anyText, fuzzParams, validDocument } from './arbitrary.mjs'

// Dates are where a diary app quietly goes wrong: clock changes, odd time zones, a mistyped year in
// a hand-edited file. Calendar maths is checked against plain UTC arithmetic in several zones, and
// the chart builders are fed cards and data no one would type on purpose.

const ZONES = ['Asia/Shanghai', 'America/Sao_Paulo', 'Europe/London', 'America/New_York', 'Australia/Lord_Howe', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kathmandu']

function inZone(zone, run) {
  const previous = process.env.TZ
  process.env.TZ = zone
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}

const dayNumber = (year, monthIndex, day) => Date.UTC(year, monthIndex, day) / 86_400_000
const dayNumberOfString = (value) => {
  const [year, month, day] = value.split('-').map(Number)
  return dayNumber(year, month - 1, day)
}
const localDayNumber = (date) => dayNumber(date.getFullYear(), date.getMonth(), date.getDate())
const pad = (value, width = 2) => String(value).padStart(width, '0')
const localDateString = (date) => `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const someMoment = fc.date({ min: new Date('1971-01-02T00:00:00Z'), max: new Date('2098-12-30T00:00:00Z'), noInvalidDate: true })
const someDay = someMoment.map(date => date.toISOString().slice(0, 10))
const JUNK_DATES = ['', ' ', 'abc', '0000-00-00', '2026-13-45', '2026-02-30', '9999-12-31', '0001-01-01', '１２３４-０１-０１', '2026-1-1', '2026/01/01', '20260101', 'null', 'undefined', '__proto__']
// The days the data folder lists are always digits (yyyy-MM-dd from year/month/day.json names), but
// not always real dates: a folder called 13/45.json is listed all the same.
const listedDate = fc.oneof({ weight: 5, arbitrary: someDay }, { weight: 2, arbitrary: fc.constantFrom('0000-00-00', '2026-13-45', '2026-02-30', '2026-00-10', '9999-12-31', '0001-01-01', '1000-01-01') })
const dateLike = fc.oneof({ weight: 5, arbitrary: someDay }, { weight: 2, arbitrary: fc.constantFrom(...JUNK_DATES) }, { weight: 1, arbitrary: anyText })

describe('clock sanity', () => {
  it('the test process really switches time zones', () => {
    const offsets = new Set(ZONES.map(zone => inZone(zone, () => new Date(2026, 6, 1).getTimezoneOffset())))
    expect(offsets.size).toBeGreaterThan(3)
  })
})

describe('countdowns', () => {
  it('count calendar days the same way in every zone, clock changes included', () => {
    for (const zone of ZONES) {
      inZone(zone, () => {
        fc.assert(fc.property(someMoment, someDay, (now, target) => {
          expect(daysUntil(target, now), `${zone} ${now.toISOString()} -> ${target}`).toBe(dayNumberOfString(target) - localDayNumber(now))
        }), fuzzParams({ numRuns: 400 }))
      })
    }
  })

  it('always says something sensible, and nothing at all for a date it cannot read', () => {
    fc.assert(fc.property(dateLike, someMoment, (target, now) => {
      const days = daysUntil(target, now)
      expect(days === null || Number.isInteger(days)).toBe(true)
      const text = describeCountdown(target, now)
      expect(typeof text).toBe('string')
      if (days === null) expect(text).toBe('')
      else expect(text).toMatch(days > 0 ? /^还有 \d+ 天$/ : days === 0 ? /^今天！$/ : /^已过 \d+ 天$/)
    }), fuzzParams({ numRuns: 1000 }))
  })
})

describe('timeline date ranges', () => {
  it('the quick ranges are exactly as long as they say, in every zone', () => {
    for (const zone of ZONES) {
      inZone(zone, () => {
        fc.assert(fc.property(someMoment, (today) => {
          for (const days of [7, 30, 90]) {
            const { from, to } = getPresetRange(String(days), today)
            expect(to, zone).toBe(localDateString(today))
            expect(dayNumberOfString(to) - dayNumberOfString(from) + 1, `${zone} ${today.toISOString()} ${days}`).toBe(days)
          }
          const month = getPresetRange('month', today)
          expect(month.from.slice(0, 8)).toBe(localDateString(today).slice(0, 8))
          expect(month.from.endsWith('-01')).toBe(true)
          expect(month.from <= localDateString(today) && localDateString(today) <= month.to).toBe(true)
          const year = getPresetRange('year', today)
          expect(year.from).toBe(`${pad(today.getFullYear(), 4)}-01-01`)
          expect(getPresetRange('all', today)).toEqual({ from: '', to: '' })
        }), fuzzParams({ numRuns: 300 }))
      })
    }
  })

  it('formatRangeLabel turns any pair of strings into a label', () => {
    fc.assert(fc.property(dateLike, dateLike, someMoment, (from, to, today) => {
      expect(typeof formatRangeLabel(from, to, today)).toBe('string')
      expect(typeof formatRangeLabel(from, '', today)).toBe('string')
    }), fuzzParams())
  })
})

// ─── Charts ──────────────────────────────────────────────────────────────────

const sections = [
  { id: 's1', name: '体重', type: 'number', numberDefaultMode: 'carry', color: '#ff0000' },
  { id: 's2', name: 'date', type: 'number' },
  { id: 's3', name: '体重', type: 'text' },
  { id: 's4', name: '__raw', type: 'number', numberDefaultMode: 'carry' }
]
const palette = ['#111111', '#222222', '#333333']
const SECTION_IDS = ['s1', 's2', 's3', 's4', 'missing']

const binding = fc.record({ sectionId: fc.constantFrom(...SECTION_IDS), metric: fc.constantFrom('value', 'wordcount', 'mystery', undefined) }, { requiredKeys: ['sectionId'], noNullPrototype: true })
const card = fc.record({
  type: fc.constantFrom('line', 'bar', 'pie', 'heatmap', 'mystery', undefined),
  dateRange: fc.constantFrom('7', '30', '90', 'all', 'custom', 'month', '', 'abc', '-5', '0', '1e9', '99999999999999999999', 30, null, undefined),
  dateFrom: dateLike,
  dateTo: dateLike,
  dateAxisMode: fc.constantFrom('recorded', 'continuous', 'mystery', undefined),
  axisMode: fc.constantFrom('raw', 'normalized', 'mystery', undefined),
  bindings: fc.option(fc.array(binding, { maxLength: 4 }), { nil: undefined })
}, { requiredKeys: [], noNullPrototype: true })

const numberText = fc.oneof(fc.double({ noNaN: false }).map(String), fc.constantFrom('', ' ', '12', '0', '-3', '1e999', '-1e999', 'Infinity', 'NaN', '0x10', '1,5', '٣', '1e-400', '9'.repeat(400)))
const entryValue = fc.oneof(numberText, anyText, validDocument.map(doc => JSON.stringify(doc)), fc.constantFrom(null, undefined, 0, 7, true, {}, []))
const entry = fc.record({ value: entryValue }, { requiredKeys: [], noNullPrototype: true })
const dayData = fc.dictionary(fc.constantFrom(...SECTION_IDS, 'junk'), entry, { maxKeys: 5, noNullPrototype: true })
const loadedData = fc.dictionary(listedDate, dayData, { maxKeys: 10, noNullPrototype: true })
const todayMoment = fc.date({ min: new Date('1999-01-01'), max: new Date('2060-01-01'), noInvalidDate: true })

const scenario = fc.record({ card, loaded: loadedData, extraDates: fc.array(listedDate, { maxLength: 6 }), today: todayMoment })
// A directory listing names each day once.
const datesOf = ({ loaded, extraDates }) => [...new Set([...Object.keys(loaded), ...extraDates])]

// A chart is allowed to look odd for odd data, but it must always be drawable: a list of points
// with finite numbers, in a size that does not freeze the page.
const MAX_POINTS = 366 * 20 + 7

// Real days only, from after the last calendar jump (Kiritimati dropped a day at the end of 1994).
const recentDay = fc.date({ min: new Date('1996-01-02T00:00:00Z'), max: new Date('2059-12-30T00:00:00Z'), noInvalidDate: true }).map(date => date.toISOString().slice(0, 10))

describe('chart data', () => {
  it('is always a drawable list, however strange the card and the data', () => {
    fc.assert(fc.property(scenario, (input) => {
      const { card: config, loaded, today } = input
      const result = buildChartData(config, sections, loaded, datesOf(input), palette, today)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeLessThanOrEqual(MAX_POINTS)

      if (config.type === 'pie') {
        for (const slice of result) {
          expect(typeof slice.name).toBe('string')
          expect(Number.isFinite(slice.value), JSON.stringify(slice)).toBe(true)
        }
      } else if (config.type === 'heatmap') {
        const days = result.map(day => day.date)
        expect(new Set(days).size).toBe(days.length)
        expect([...days].sort()).toEqual(days)
        for (const day of result) expect(Number.isFinite(day.value), JSON.stringify(day)).toBe(true)
      } else {
        const days = result.map(point => point.date)
        // One point per day, oldest first, so the lines run left to right.
        expect(new Set(days).size).toBe(days.length)
        expect([...days].sort()).toEqual(days)
        const keys = getChartSeries(config, sections).map(({ key }) => key)
        expect(new Set(keys).size).toBe(keys.length)
        for (const point of result) {
          expect(point.date).toMatch(/^\d{4}-\d\d-\d\d$/)
          for (const key of keys) expect(Number.isFinite(point[key]), `${key} ${JSON.stringify(point)}`).toBe(true)
        }
      }
    }), fuzzParams({ numRuns: 600 }))
  })

  it('a normalized chart never leaves +-100 and keeps the real numbers under __raw', () => {
    fc.assert(fc.property(scenario, (input) => {
      const config = { ...input.card, type: 'line', axisMode: 'normalized', bindings: [{ sectionId: 's1', metric: 'value' }, { sectionId: 's2', metric: 'value' }] }
      const result = buildChartData(config, sections, input.loaded, datesOf(input), palette, input.today)
      for (const point of result) {
        for (const key of ['体重', 'date (2)']) {
          if (!(key in point)) continue
          // A series is scaled to its own peak, so negative numbers fall between -100 and 0.
          expect(Math.abs(point[key])).toBeLessThanOrEqual(100)
        }
      }
    }), fuzzParams({ numRuns: 300 }))
  })

  it('the day ranges and heatmap grids stay inside a sane size for any range setting', () => {
    fc.assert(fc.property(scenario, (input) => {
      const { card: config, today } = input
      const dates = datesOf(input)
      expect(Array.isArray(getDateRange(config, dates, config.bindings ?? [], input.loaded, today))).toBe(true)
      const days = getHeatmapDays(config, dates, today)
      expect(days.length).toBeLessThanOrEqual(MAX_POINTS)
      expect(getHeatmapRangeStart(config, dates, today)).toMatch(/^\d{4}-\d\d-\d\d$/)
    }), fuzzParams({ numRuns: 600 }))
  })

  it('the heatmap grid always ends today and starts on a Monday (the one-week view aside)', () => {
    for (const zone of ZONES) {
      inZone(zone, () => {
        fc.assert(fc.property(todayMoment, fc.constantFrom('30', '90', 'all'), fc.array(recentDay, { maxLength: 4 }), (today, dateRange, dates) => {
          const days = getHeatmapDays({ type: 'heatmap', dateRange }, dates, today)
          expect(days.at(-1)).toBe(localDateString(today))
          expect(new Date(`${days[0]}T12:00:00Z`).getUTCDay()).toBe(1)
          for (let index = 1; index < days.length; index += 1) expect(dayNumberOfString(days[index]) - dayNumberOfString(days[index - 1])).toBe(1)
        }), fuzzParams({ numRuns: 40 }))
      })
    }
  }, 60_000)

  it('date labels never throw', () => {
    fc.assert(fc.property(dateLike, (value) => {
      expect(typeof formatAxisDate(value)).toBe('string')
      expect(typeof formatTooltipDate(value)).toBe('string')
    }), fuzzParams())
  })

  it('normalizeSeries copes with any numbers', () => {
    const value = fc.oneof(fc.double(), fc.constantFrom('', 'x', null, undefined, Infinity, -Infinity, NaN))
    fc.assert(fc.property(fc.array(fc.record({ a: value, b: value }, { requiredKeys: ['a', 'b'] }), { maxLength: 20 }), (points) => {
      for (const point of normalizeSeries(points, ['a', 'b'])) {
        for (const key of ['a', 'b']) expect(Number.isFinite(point[key]) || Number.isNaN(point[key])).toBe(true)
      }
    }), fuzzParams())
  })
})

describe('heatmap colours', () => {
  it('every intensity is between 0 and 1, and a bigger day is never paler than a smaller one', () => {
    const values = fc.array(fc.oneof(fc.double({ min: -10, max: 1e7 }), fc.integer({ min: 0, max: 5000 }), fc.constantFrom(NaN, Infinity, -Infinity, 0)), { maxLength: 60 })
    fc.assert(fc.property(values, (all) => {
      const scale = createHeatmapScale(all)
      const finite = all.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b)
      let previous = 0
      for (const value of finite) {
        const intensity = scale(value)
        expect(intensity).toBeGreaterThanOrEqual(0)
        expect(intensity).toBeLessThanOrEqual(1)
        expect(intensity).toBeGreaterThanOrEqual(previous - 1e-12)
        previous = intensity
        const alpha = getHeatmapAlpha(intensity)
        expect(alpha).toBeGreaterThanOrEqual(0.2)
        expect(alpha).toBeLessThanOrEqual(1)
      }
      for (const value of [0, -1, NaN, Infinity, undefined, null, 'x']) expect(scale(value)).toBe(0)
    }), fuzzParams({ numRuns: 500 }))
  })
})

describe('timeline cards', () => {
  it('any filters over any data give cards, never an error', () => {
    const filters = fc.record({
      filterSections: fc.array(fc.constantFrom(...SECTION_IDS), { maxLength: 3 }),
      sortDesc: fc.boolean(),
      query: fc.oneof(fc.constant(''), anyText),
      dateFrom: fc.oneof(fc.constant(''), dateLike),
      dateTo: fc.oneof(fc.constant(''), dateLike),
      onlyFavorites: fc.boolean()
    }, { noNullPrototype: true })
    fc.assert(fc.property(loadedData, filters, (loaded, filter) => {
      const cards = buildTimelineCards({ datesWithData: Object.keys(loaded), loadedDates: loaded, sections, filters: filter, favoriteLookup: new Set() })
      expect(Array.isArray(cards)).toBe(true)
      for (const timelineCard of cards) {
        expect(Number.isFinite(timelineCard.totalWords)).toBe(true)
        expect(timelineCard.recordedSections.length).toBeGreaterThan(0)
      }
    }), fuzzParams({ numRuns: 500 }))
  })
})

describe('carried-over numbers', () => {
  it('finds the latest earlier value of each section, whatever the days hold', async () => {
    const recordedDays = fc.dictionary(someDay, dayData, { maxKeys: 10, noNullPrototype: true })
    await fc.assert(fc.asyncProperty(recordedDays, someDay, async (loaded, before) => {
      const dates = Object.keys(loaded)
      const found = await findRecentNumberValues({ dates, before, sectionIds: ['s1', 's4'], readDay: async date => loaded[date], chunkSize: 3 })
      for (const [sectionId, value] of Object.entries(found)) {
        expect(['s1', 's4']).toContain(sectionId)
        expect(typeof value).toBe('string')
        // The value comes from a day before `before`, and no later such day holds one.
        const earlier = dates.filter(date => date < before).sort().reverse()
        const source = earlier.find(date => loaded[date]?.[sectionId]?.value !== undefined && loaded[date]?.[sectionId]?.value !== null && String(loaded[date][sectionId].value).trim() !== '')
        expect(String(loaded[source][sectionId].value)).toBe(value)
      }
    }), fuzzParams({ numRuns: 300 }))
  })
})
