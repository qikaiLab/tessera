import { describe, expect, it } from 'vitest'
import {
  buildChartData,
  formatAxisDate,
  formatTooltipDate,
  getChartSeries,
  getDateRange,
  getHeatmapColor,
  hasChartBindingData,
  isNormalizedChart,
  resolveBindingValue
} from '../src/renderer/src/utils/analyticsData.js'

const today = new Date(2026, 9, 13) // 2026-10-13
const palette = ['#111111', '#222222', '#333333']

const doc = (text) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

const sections = [
  { id: 'steps', name: '步数', type: 'number', resident: false, color: '#ff0000' },
  { id: 'sleep', name: '睡眠', type: 'number', resident: false, numberDefaultMode: 'carry' },
  { id: 'diary', name: '日记', type: 'text', resident: true }
]

const loadedData = {
  '2026-10-10': { steps: { value: '4000' }, sleep: { value: '7' }, diary: { value: doc('今天 很好') } },
  '2026-10-12': { steps: { value: '6000' }, diary: { value: doc('abc') } },
  '2026-10-13': { steps: { value: '8000' } }
}
const datesWithData = Object.keys(loadedData)

const card = (overrides) => ({
  type: 'line', bindings: [], dateRange: '7', dateAxisMode: 'recorded', ...overrides
})
const steps = { sectionId: 'steps', metric: 'value' }
const sleep = { sectionId: 'sleep', metric: 'value' }
const diaryWords = { sectionId: 'diary', metric: 'wordcount' }

describe('which days a chart covers', () => {
  it('uses the recorded days inside the range', () => {
    expect(getDateRange(card({ dateRange: '7' }), datesWithData, [], loadedData, today)).toEqual(datesWithData)
    expect(getDateRange(card({ dateRange: '2' }), datesWithData, [], loadedData, today)).toEqual(['2026-10-12', '2026-10-13'])
    expect(getDateRange(card({ dateRange: 'custom', dateFrom: '2026-10-11', dateTo: '2026-10-12' }), datesWithData, [], loadedData, today))
      .toEqual(['2026-10-12'])
    expect(getDateRange(card({ dateRange: 'all' }), datesWithData, [], loadedData, today)).toEqual(datesWithData)
  })

  it('lists every calendar day on a continuous axis', () => {
    const continuous = card({ dateRange: '4', dateAxisMode: 'continuous' })
    expect(getDateRange(continuous, datesWithData, [steps], loadedData, today))
      .toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'])
    const all = card({ dateRange: 'all', dateAxisMode: 'continuous' })
    expect(getDateRange(all, datesWithData, [steps], loadedData, today)).toEqual([
      '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'
    ])
    const custom = card({ dateRange: 'custom', dateFrom: '2026-10-05', dateTo: '2026-10-03', dateAxisMode: 'continuous' })
    expect(getDateRange(custom, datesWithData, [steps], loadedData, today)).toEqual([])
  })

  it('covers exactly N days for "last N days": today and the N-1 before it, nothing dated later', () => {
    // today is 2026-10-13: a 7-day window starts on 10-07.
    const recorded = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-13', '2026-10-14']
    expect(getDateRange(card({ dateRange: '7' }), recorded, [], {}, today))
      .toEqual(['2026-10-07', '2026-10-13'])
    // The continuous axis spans the same 7 days.
    const continuous = getDateRange(card({ dateRange: '7', dateAxisMode: 'continuous' }), recorded, [steps], {}, today)
    expect(continuous).toHaveLength(7)
    expect(continuous[0]).toBe('2026-10-07')
    // An unusable range falls back to 30 days instead of comparing with "NaN-NaN-NaN".
    expect(getDateRange(card({ dateRange: 'weird' }), recorded, [], {}, today)).toEqual(recorded.slice(0, 4))
  })

  it('does not stretch an all-time continuous axis to a stray far-future day', () => {
    const typo = { ...loadedData, '2062-01-01': { steps: { value: '1' } } }
    const all = card({ dateRange: 'all', dateAxisMode: 'continuous' })
    const days = getDateRange(all, Object.keys(typo), [steps], typo, today)
    expect(days.at(-1)).toBe('2026-10-13')
    expect(days).toHaveLength(4)
    // Even a typo in the past is bounded.
    const ancient = { '1800-01-01': { steps: { value: '1' } }, ...loadedData }
    expect(getDateRange(all, Object.keys(ancient), [steps], ancient, today).length).toBeLessThanOrEqual(366 * 20)
  })

  it('does not reorder the days it is given', () => {
    const unsorted = ['2026-10-13', '2026-10-10']
    buildChartData(card({ dateRange: 'all', bindings: [steps] }), sections, loadedData, unsorted, palette, today)
    expect(unsorted).toEqual(['2026-10-13', '2026-10-10'])
  })
})

describe('values', () => {
  it('knows when a day has something to draw', () => {
    expect(hasChartBindingData('2026-10-10', [steps], loadedData)).toBe(true)
    expect(hasChartBindingData('2026-10-11', [steps], loadedData)).toBe(false)
    // A text section with only spaces has no words.
    expect(hasChartBindingData('x', [diaryWords], { x: { diary: { value: doc('   ') } } })).toBe(false)
    expect(hasChartBindingData('2026-10-12', [diaryWords], loadedData)).toBe(true)
  })

  it('counts characters without spaces for text sections', () => {
    expect(resolveBindingValue('2026-10-10', diaryWords, sections[2], loadedData)).toBe(4)
  })

  it('carries the last number over for sections set to do so, and 0 for the others', () => {
    expect(resolveBindingValue('2026-10-13', sleep, sections[1], loadedData)).toBe(7)
    expect(resolveBindingValue('2026-10-09', sleep, sections[1], loadedData)).toBe(0)
    expect(resolveBindingValue('2026-10-11', steps, sections[0], loadedData)).toBe(0)
  })
})

describe('chart data', () => {
  it('draws one point per recorded day for a line chart', () => {
    const data = buildChartData(card({ bindings: [steps] }), sections, loadedData, datesWithData, palette, today)
    expect(data).toEqual([
      { date: '2026-10-10', 步数: 4000 },
      { date: '2026-10-12', 步数: 6000 },
      { date: '2026-10-13', 步数: 8000 }
    ])
  })

  it('keeps quiet days on a continuous axis', () => {
    const data = buildChartData(card({ dateRange: '4', dateAxisMode: 'continuous', bindings: [steps] }), sections, loadedData, datesWithData, palette, today)
    expect(data.map(point => point.步数)).toEqual([4000, 0, 6000, 8000])
  })

  it('draws only the days where a bound section has data on a recorded axis', () => {
    const data = buildChartData(card({ bindings: [sleep] }), sections, loadedData, datesWithData, palette, today)
    expect(data.map(point => point.date)).toEqual(['2026-10-10'])
  })

  it('normalizes several series to a percentage of their own peak', () => {
    const data = buildChartData(card({ type: 'bar', axisMode: 'normalized', bindings: [steps, diaryWords] }), sections, loadedData, datesWithData, palette, today)
    expect(isNormalizedChart(card({ type: 'bar', axisMode: 'normalized' }), 2)).toBe(true)
    expect(isNormalizedChart(card({ type: 'bar', axisMode: 'normalized' }), 1)).toBe(false)
    expect(isNormalizedChart(card({ type: 'pie', axisMode: 'normalized' }), 2)).toBe(false)
    expect(data[2].步数).toBe(100)
    expect(data[2].__raw.步数).toBe(8000)
  })

  it('totals each bound section into a pie slice, coloured by the section or the palette', () => {
    const data = buildChartData(card({ type: 'pie', bindings: [steps, sleep, { sectionId: 'gone', metric: 'value' }] }), sections, loadedData, datesWithData, palette, today)
    expect(data).toEqual([
      { name: '步数', value: 18000, fill: '#ff0000' },
      { name: '睡眠', value: 7, fill: '#222222' }
    ])
  })

  it('gives a heatmap every day of its weeks, quiet days as 0', () => {
    const data = buildChartData(card({ type: 'heatmap', dateRange: '7', bindings: [steps] }), sections, loadedData, datesWithData, palette, today)
    expect(data.at(-1)).toEqual({ date: '2026-10-13', value: 8000 })
    expect(data.find(day => day.date === '2026-10-11').value).toBe(0)
    expect(buildChartData(card({ type: 'heatmap', bindings: [] }), sections, loadedData, datesWithData, palette, today).every(day => day.value === 0)).toBe(true)
  })

  it('picks the heatmap colour from the section, then the palette', () => {
    expect(getHeatmapColor(card({ type: 'heatmap', bindings: [steps] }), sections, palette)).toBe('#ff0000')
    expect(getHeatmapColor(card({ type: 'heatmap', bindings: [sleep] }), sections, palette)).toBe('#222222')
    expect(getHeatmapColor(card({ type: 'line', bindings: [steps] }), sections, palette)).toBe('#111111')
  })
})

describe('sections with the same name', () => {
  const twins = [
    { id: 'a', name: '体重', type: 'number', color: '#aa0000' },
    { id: 'b', name: '体重', type: 'number', color: '#00aa00' },
    { id: 'c', name: 'date', type: 'number' }
  ]
  const twinData = { '2026-10-12': { a: { value: '70' }, b: { value: '5' }, c: { value: '9' } } }
  const bindings = [
    { sectionId: 'a', metric: 'value' },
    { sectionId: 'b', metric: 'value' },
    { sectionId: 'c', metric: 'value' }
  ]

  it('gives every bound section its own series key', () => {
    expect(getChartSeries(card({ bindings }), twins).map(item => item.key)).toEqual(['体重', '体重 (2)', 'date (2)'])
    // Sections that are not bound take no key.
    expect(getChartSeries(card({ bindings: [bindings[1]] }), twins).map(item => item.key)).toEqual(['体重'])
  })

  it('draws both values instead of letting the later one overwrite the first', () => {
    const data = buildChartData(card({ bindings }), twins, twinData, Object.keys(twinData), palette, today)
    expect(data).toEqual([{ date: '2026-10-12', 体重: 70, '体重 (2)': 5, 'date (2)': 9 }])
  })

  it('normalizes each of them on its own', () => {
    const data = buildChartData(card({ axisMode: 'normalized', bindings: bindings.slice(0, 2) }), twins, twinData, Object.keys(twinData), palette, today)
    expect(data[0].体重).toBe(100)
    expect(data[0]['体重 (2)']).toBe(100)
    expect(data[0].__raw).toEqual({ 体重: 70, '体重 (2)': 5 })
  })
})

describe('the heatmap grid', () => {
  it('shows exactly the last 7 days for "last 7 days", whatever weekday it is', () => {
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(2026, 9, 12 + offset)
      const data = buildChartData(card({ type: 'heatmap', dateRange: '7', bindings: [steps] }), sections, loadedData, datesWithData, palette, day)
      expect(data).toHaveLength(7)
      expect(data.some(entry => entry.padded)).toBe(false)
    }
  })

  // Wed 2026-10-14: 30 days back starts on Tue 09-15, so the grid starts on Mon 09-14.
  const wednesday = new Date(2026, 9, 14)

  it('marks the days that only complete the first week as padding with no value', () => {
    const recorded = { '2026-09-15': { steps: { value: '999' } }, '2026-10-12': { steps: { value: '5' } } }
    const data = buildChartData(card({ type: 'heatmap', dateRange: '30', bindings: [steps] }), sections, recorded, Object.keys(recorded), palette, wednesday)
    expect(data[0]).toEqual({ date: '2026-09-14', value: 0, padded: true })
    expect(data.find(day => !day.padded)).toEqual({ date: '2026-09-15', value: 999 })
    expect(data.filter(day => day.padded)).toHaveLength(1)
    expect(data.at(-1)).toEqual({ date: '2026-10-14', value: 0 })
  })

  it('draws no value for padding, even when that day has one older than the range', () => {
    const recorded = { '2026-09-14': { steps: { value: '12345' } } }
    const data = buildChartData(card({ type: 'heatmap', dateRange: '30', bindings: [steps] }), sections, recorded, Object.keys(recorded), palette, wednesday)
    expect(data[0]).toEqual({ date: '2026-09-14', value: 0, padded: true })
    expect(Math.max(...data.map(day => day.value))).toBe(0)
  })
})

describe('carrying a number over', () => {
  const section = { id: 'sleep', name: '睡眠', type: 'number', numberDefaultMode: 'carry' }

  it('finds the latest earlier value on a long history', () => {
    const history = {}
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10)
      history[date] = day === 0 ? { sleep: { value: '6' } } : {}
    }
    for (const date of Object.keys(history)) {
      expect(resolveBindingValue(date, sleep, section, history)).toBe(6)
    }
    // Before the first value there is nothing to carry.
    expect(resolveBindingValue('2024-12-31', sleep, section, history)).toBe(0)
  })

  it('looks at a new data set afresh', () => {
    const data = { '2026-10-01': { sleep: { value: '5' } } }
    expect(resolveBindingValue('2026-10-05', sleep, section, data)).toBe(5)
    // A new data set is a new object (that is how the page loads days).
    const next = { ...data, '2026-10-03': { sleep: { value: '8' } } }
    expect(resolveBindingValue('2026-10-05', sleep, section, next)).toBe(8)
  })
})

describe('date labels', () => {
  it('formats axis and tooltip dates and passes unparseable values through', () => {
    expect(formatAxisDate('2026-10-13')).toBe('10/13')
    expect(formatTooltipDate('2026-10-13')).toBe('2026-10-13')
    expect(formatAxisDate('not a date')).toBe('not a date')
  })
})

describe('damaged or mistyped data', () => {
  const stepsBinding = { sectionId: 'steps', metric: 'value' }

  it('a range setting beyond any real calendar still draws, capped at 20 years', () => {
    for (const dateRange of ['99999999999999999999', '1e9', '-5', '0']) {
      for (const type of ['line', 'bar', 'pie', 'heatmap']) {
        for (const dateAxisMode of ['recorded', 'continuous']) {
          const data = buildChartData(card({ type, dateRange, dateAxisMode, bindings: [stepsBinding] }), sections, loadedData, datesWithData, palette, today)
          expect(Array.isArray(data), `${type} ${dateRange}`).toBe(true)
          expect(data.length).toBeLessThanOrEqual(366 * 20 + 7)
        }
      }
    }
  })

  it('one stray, very old day does not turn the all-time heatmap into hundreds of thousands of cells', () => {
    const data = buildChartData(card({ type: 'heatmap', dateRange: 'all', bindings: [stepsBinding] }), sections, loadedData, ['0001-01-01', ...datesWithData], palette, today)
    expect(data.length).toBeLessThanOrEqual(366 * 20 + 7)
    expect(data.at(-1).date).toBe('2026-10-13')
  })

  it('numbers that read as infinity count as 0, so a chart is never drawn off the page', () => {
    const odd = {
      '2026-10-12': { steps: { value: '1e999' } },
      '2026-10-13': { steps: { value: '-1e999' } }
    }
    const line = buildChartData(card({ type: 'line', dateRange: '7', bindings: [stepsBinding] }), sections, odd, Object.keys(odd), palette, today)
    expect(line.map(point => point['步数'])).toEqual([0, 0])
    const [slice] = buildChartData(card({ type: 'pie', dateRange: '7', bindings: [stepsBinding] }), sections, odd, Object.keys(odd), palette, today)
    expect(slice.value).toBe(0)
  })
})
