import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns'
import {
  AXIS_NORMALIZED,
  DATE_AXIS_CONTINUOUS,
  getAxisMode,
  getDateAxisMode,
  getHeatmapDays,
  getHeatmapRangeStart,
  getRangeDays,
  MAX_RANGE_DAYS,
  normalizeSeries
} from './analyticsCard'
import { hasStoredValue } from './dayEntries'
import { extractPlainText } from './richText'
import { NUMBER_DEFAULT_MODE, getNumberDefaultMode } from './sectionDefaults'

// Turning the recorded days into what an analytics chart draws. `loadedData` maps a date to that
// day's entries ({ [sectionId]: { value } }); `card` is the chart's saved configuration.

const isLineOrBar = (card) => card.type === 'line' || card.type === 'bar'

const wordCount = (value) => extractPlainText(value).replace(/\s+/g, '').length

function isCarryNumberSection(section) {
  return section?.type === 'number' && getNumberDefaultMode(section) === NUMBER_DEFAULT_MODE.CARRY
}

// ─── Which days a chart covers ───────────────────────────────────────────────

// Days that have data, within the card's range ("all", a custom range, or the last N days).
function getRecordedDateRange(card, datesWithData, today) {
  if (card.dateRange === 'all') return datesWithData
  if (card.dateRange === 'custom' && card.dateFrom && card.dateTo) {
    return datesWithData.filter(d => d >= card.dateFrom && d <= card.dateTo)
  }
  // "Last N days" is today and the N-1 days before it, the same window the continuous axis and the
  // heatmap use; days dated after today (the record page can open them) are not part of it.
  const days = getRangeDays(card)
  const cutoff = format(subDays(today, days - 1), 'yyyy-MM-dd')
  const latest = format(today, 'yyyy-MM-dd')
  return datesWithData.filter(d => d >= cutoff && d <= latest)
}

// Every calendar day of the range, with or without data.
function getContinuousDateRange(card, datesWithData, bindings, loadedData, today) {
  let start
  let end

  if (card.dateRange === 'custom' && card.dateFrom && card.dateTo) {
    start = parseISO(card.dateFrom)
    end = parseISO(card.dateTo)
  } else if (card.dateRange === 'all') {
    const boundDates = datesWithData.filter(d => hasChartBindingData(d, bindings, loadedData))
    const sorted = [...(boundDates.length ? boundDates : datesWithData)].sort()
    if (!sorted.length) return []
    start = parseISO(sorted[0])
    // Up to today: a stray far-future date would otherwise stretch the axis over decades.
    end = parseISO(sorted[sorted.length - 1])
    if (end > today) end = today
  } else {
    end = today
    start = subDays(end, getRangeDays(card) - 1)
  }

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return []
  }
  const earliest = subDays(end, MAX_RANGE_DAYS - 1)
  if (start < earliest) start = earliest
  return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'))
}

export function getDateRange(card, datesWithData, bindings = [], loadedData = {}, today = new Date()) {
  if (isLineOrBar(card) && getDateAxisMode(card) === DATE_AXIS_CONTINUOUS) {
    return getContinuousDateRange(card, datesWithData, bindings, loadedData, today)
  }
  return getRecordedDateRange(card, datesWithData, today)
}

// ─── Values ──────────────────────────────────────────────────────────────────

// Whether the day holds something any of the bindings would draw.
export function hasChartBindingData(dateStr, bindings, loadedData) {
  return bindings.some(binding => {
    const entry = loadedData[dateStr]?.[binding.sectionId]
    if (!hasStoredValue(entry)) return false
    if (binding.metric === 'wordcount') return wordCount(entry.value) > 0
    return String(entry.value).trim() !== ''
  })
}

// The recorded days, oldest first. Sorted once per loaded data set (a new set replaces the old one
// whenever a day changes), not once per point of a long chart.
const sortedDatesCache = new WeakMap()
function sortedRecordedDates(loadedData) {
  let dates = sortedDatesCache.get(loadedData)
  if (!dates) {
    dates = Object.keys(loadedData).sort()
    sortedDatesCache.set(loadedData, dates)
  }
  return dates
}

// The latest number recorded before `dateStr` (for number sections that carry their value over).
function findRecentNumberValue(dateStr, sectionId, loadedData) {
  const dates = sortedRecordedDates(loadedData)
  // First day that is not before `dateStr`; everything left of it is earlier.
  let low = 0
  let high = dates.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (dates[middle] < dateStr) low = middle + 1
    else high = middle
  }
  for (let i = low - 1; i >= 0; i -= 1) {
    const entry = loadedData[dates[i]]?.[sectionId]
    if (hasStoredValue(entry)) return finiteNumber(entry.value)
  }
  return 0
}

// A number a chart can draw: text that reads as infinity ("1e999") or as nothing counts as 0.
const finiteNumber = (value) => {
  const number = parseFloat(value)
  return Number.isFinite(number) ? number : 0
}

function entryNumber(entry, binding) {
  if (!entry) return 0
  return binding.metric === 'wordcount' ? wordCount(entry.value) : finiteNumber(entry.value)
}

export function resolveBindingValue(dateStr, binding, section, loadedData) {
  const entry = loadedData[dateStr]?.[binding.sectionId]
  if (hasStoredValue(entry)) return entryNumber(entry, binding)
  if (binding.metric === 'value' && isCarryNumberSection(section)) {
    return findRecentNumberValue(dateStr, binding.sectionId, loadedData)
  }
  return 0
}

// Normalizing only makes sense for line / bar charts that compare several series.
export function isNormalizedChart(card, seriesCount) {
  return isLineOrBar(card) && getAxisMode(card) === AXIS_NORMALIZED && seriesCount >= 2
}

// ─── Chart data ──────────────────────────────────────────────────────────────

function buildPieData(card, sections, loadedData, dates, palette) {
  return (card.bindings || []).map((binding, index) => {
    const section = sections.find(s => s.id === binding.sectionId)
    if (!section) return null
    let total = 0
    for (const d of dates) total += entryNumber(loadedData[d]?.[binding.sectionId], binding)
    return { name: section.name, value: parseFloat(total.toFixed(2)), fill: section.color || palette[index % palette.length] }
  }).filter(Boolean)
}

// Every day of the range, quiet days as 0. The days that only complete the first week of the grid
// are marked `padded`: they are drawn as blank spaces and carry no value, so they neither colour
// the cell nor stretch the colour scale.
function buildHeatmapData(card, loadedData, datesWithData, today) {
  const days = getHeatmapDays(card, datesWithData, today)
  const firstDay = getHeatmapRangeStart(card, datesWithData, today)
  const binding = (card.bindings || [])[0]
  return days.map(date => {
    if (date < firstDay) return { date, value: 0, padded: true }
    return { date, value: binding ? entryNumber(loadedData[date]?.[binding.sectionId], binding) : 0 }
  })
}

// Keys a point already uses for something other than a series.
const RESERVED_POINT_KEYS = ['date', '__raw']

/**
 * The bound sections of a line / bar chart, in the order the sections are listed, each with the key
 * its values are stored (and drawn, and labelled in the legend) under. That is the section's name,
 * but names are not unique and a section may even be called "date": the later one gets a number
 * ("体重 (2)") instead of overwriting the first one's values.
 */
export function getChartSeries(card, sections) {
  const bound = new Set((card.bindings || []).map(binding => binding.sectionId))
  const taken = new Set(RESERVED_POINT_KEYS)
  return sections.filter(section => bound.has(section.id)).map(section => {
    let key = section.name
    for (let n = 2; taken.has(key); n += 1) key = `${section.name} (${n})`
    taken.add(key)
    return { key, section }
  })
}

// One point per day with a value per bound section (keyed as getChartSeries says).
function buildSeriesData(card, sections, loadedData, dates) {
  const bindings = card.bindings || []
  const series = getChartSeries(card, sections).map(({ key, section }) => ({
    key,
    section,
    binding: bindings.find(binding => binding.sectionId === section.id)
  }))
  const points = dates.map(date => {
    const point = { date }
    for (const { key, section, binding } of series) {
      point[key] = resolveBindingValue(date, binding, section, loadedData)
    }
    return point
  })
  const keys = series.map(item => item.key)
  return isNormalizedChart(card, keys.length) ? normalizeSeries(points, keys) : points
}

/**
 * The data a chart card draws: slices for a pie, days for a heatmap, one point per day for
 * line and bar charts (continuous axis: every day of the range; otherwise only days with data
 * for a bound section).
 */
export function buildChartData(card, sections, loadedData, datesWithData, palette, today = new Date()) {
  const bindings = card.bindings || []
  const candidates = [...getDateRange(card, datesWithData, bindings, loadedData, today)].sort()
  const dates = isLineOrBar(card) && getDateAxisMode(card) !== DATE_AXIS_CONTINUOUS
    ? candidates.filter(d => hasChartBindingData(d, bindings, loadedData))
    : candidates

  if (card.type === 'pie') return buildPieData(card, sections, loadedData, dates, palette)
  if (card.type === 'heatmap') return buildHeatmapData(card, loadedData, datesWithData, today)
  return buildSeriesData(card, sections, loadedData, dates)
}

// The colour a heatmap is drawn in: its section's own colour, else a palette colour by position.
export function getHeatmapColor(card, sections, palette) {
  const binding = (card.bindings || [])[0]
  if (card.type !== 'heatmap' || !binding) return palette[0]
  const section = sections.find(s => s.id === binding.sectionId)
  if (section?.color) return section.color
  const index = sections.findIndex(s => s.id === binding.sectionId)
  return palette[Math.max(0, index) % palette.length]
}

export function formatAxisDate(value) {
  try {
    return format(parseISO(value), 'MM/dd')
  } catch {
    return value
  }
}

export function formatTooltipDate(value) {
  try {
    return format(parseISO(value), 'yyyy-MM-dd')
  } catch {
    return value
  }
}
