import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns'
import {
  AXIS_NORMALIZED,
  DATE_AXIS_CONTINUOUS,
  getAxisMode,
  getDateAxisMode,
  getHeatmapDays,
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
  const days = parseInt(card.dateRange)
  const cutoff = format(subDays(today, days), 'yyyy-MM-dd')
  return datesWithData.filter(d => d >= cutoff)
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
    end = parseISO(sorted[sorted.length - 1])
  } else {
    const days = parseInt(card.dateRange) || 30
    end = today
    start = subDays(end, days - 1)
  }

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return []
  }
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

// The latest number recorded before `dateStr` (for number sections that carry their value over).
function findRecentNumberValue(dateStr, sectionId, loadedData) {
  const previousDates = Object.keys(loadedData)
    .filter(d => d < dateStr)
    .sort((a, b) => b.localeCompare(a))

  for (const d of previousDates) {
    const entry = loadedData[d]?.[sectionId]
    if (hasStoredValue(entry)) return parseFloat(entry.value) || 0
  }
  return 0
}

function entryNumber(entry, binding) {
  if (!entry) return 0
  return binding.metric === 'wordcount' ? wordCount(entry.value) : parseFloat(entry.value) || 0
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

// Every day of the range, quiet days as 0.
function buildHeatmapData(card, loadedData, datesWithData, today) {
  const days = getHeatmapDays(card, datesWithData, today)
  const binding = (card.bindings || [])[0]
  if (!binding) return days.map(date => ({ date, value: 0 }))
  return days.map(date => ({ date, value: entryNumber(loadedData[date]?.[binding.sectionId], binding) }))
}

// One point per day with a value per bound section (keyed by the section's name).
function buildSeriesData(card, sections, loadedData, dates) {
  const bindings = card.bindings || []
  const series = dates.map(date => {
    const point = { date }
    for (const binding of bindings) {
      const section = sections.find(s => s.id === binding.sectionId)
      if (section) point[section.name] = resolveBindingValue(date, binding, section, loadedData)
    }
    return point
  })
  const names = bindings.map(b => sections.find(s => s.id === b.sectionId)?.name).filter(Boolean)
  return isNormalizedChart(card, names.length) ? normalizeSeries(series, names) : series
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
