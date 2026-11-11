import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns'

export const CHART_TYPES = [
  { id: 'line', label: '折线图', icon: '📈' },
  { id: 'bar', label: '柱状图', icon: '📊' },
  { id: 'pie', label: '饼图', icon: '🍩' },
  { id: 'heatmap', label: '热力图', icon: '🗓' }
]

export const DATE_RANGES = [
  { id: '7', label: '近7天' },
  { id: '30', label: '近30天' },
  { id: '90', label: '近90天' },
  { id: '365', label: '近一年' },
  { id: 'all', label: '全部' }
]

export const DATE_AXIS_RECORDED = 'recorded'
export const DATE_AXIS_CONTINUOUS = 'continuous'
export const LINE_STYLE_SMOOTH = 'smooth'
export const LINE_STYLE_STRAIGHT = 'straight'

export const DATE_AXIS_MODES = [
  { id: DATE_AXIS_RECORDED, label: '仅有数据的日期' },
  { id: DATE_AXIS_CONTINUOUS, label: '连续日期' }
]

export const LINE_STYLE_MODES = [
  { id: LINE_STYLE_SMOOTH, label: '曲线' },
  { id: LINE_STYLE_STRAIGHT, label: '直线折线' }
]

export const AXIS_RAW = 'raw'
export const AXIS_NORMALIZED = 'normalized'

export const AXIS_MODES = [
  { id: AXIS_RAW, label: '原始数值' },
  { id: AXIS_NORMALIZED, label: '归一化（0–100%）' }
]

export function getAxisMode(card) {
  return card.axisMode === AXIS_NORMALIZED ? AXIS_NORMALIZED : AXIS_RAW
}

export function getDateAxisMode(card) {
  return card.dateAxisMode === DATE_AXIS_CONTINUOUS ? DATE_AXIS_CONTINUOUS : DATE_AXIS_RECORDED
}

export function getLineStyle(card) {
  return card.lineStyle === LINE_STYLE_STRAIGHT ? LINE_STYLE_STRAIGHT : LINE_STYLE_SMOOTH
}

// Text sections chart their character count, number sections their value.
export function getMetricForSection(section) {
  return section?.type === 'text' ? 'wordcount' : 'value'
}

export function getMetricLabel(metric) {
  return metric === 'wordcount' ? '字数' : '数值'
}

// The list of bound sections is shared by every chart type, so switching type never
// discards a selection. Heatmaps can only draw one series: the first bound one.
export function getDrawnBindings(card) {
  const bindings = card.bindings || []
  return card.type === 'heatmap' ? bindings.slice(0, 1) : bindings
}

// Set the bound sections to exactly `sectionIds`, keeping the existing entries (and their
// order) for sections that stay and appending newly picked ones.
export function setBoundSections(bindings, sectionIds, sections) {
  const wanted = new Set(sectionIds)
  const kept = (bindings || []).filter(binding => wanted.has(binding.sectionId))
  const known = new Set(kept.map(binding => binding.sectionId))
  const added = sectionIds
    .filter(id => !known.has(id))
    .map(id => sections.find(section => section.id === id))
    .filter(Boolean)
    .map(section => ({ sectionId: section.id, metric: getMetricForSection(section) }))
  return [...kept, ...added]
}

export function moveBindingToFront(bindings, sectionId) {
  const list = bindings || []
  const target = list.find(binding => binding.sectionId === sectionId)
  if (!target) return list
  return [target, ...list.filter(binding => binding !== target)]
}

const HEATMAP_DEFAULT_DAYS = 365

// The first day a heatmap's range covers. "All time" runs from the first recorded day (or a year
// back when nothing is recorded yet, or the dates are unusable).
function getHeatmapStart(card, datesWithData, today) {
  if (card.dateRange === 'all') {
    const earliest = [...datesWithData].sort()[0]
    const start = earliest ? parseISO(earliest) : subDays(today, HEATMAP_DEFAULT_DAYS - 1)
    return Number.isNaN(start.getTime()) || start > today ? subDays(today, HEATMAP_DEFAULT_DAYS - 1) : start
  }
  const days = parseInt(card.dateRange, 10) || 30
  return subDays(today, days - 1)
}

export function getHeatmapRangeStart(card, datesWithData = [], today = new Date()) {
  return format(getHeatmapStart(card, datesWithData, today), 'yyyy-MM-dd')
}

// Every calendar day a heatmap draws, as yyyy-MM-dd, up to today. Weekly grids start on a Monday
// so each column is a full week (the days before the range only fill that first column: see
// getHeatmapRangeStart); the one-row "last 7 days" view shows exactly those 7 days. "All time"
// keeps the empty days so the weeks line up.
export function getHeatmapDays(card, datesWithData = [], today = new Date()) {
  const start = getHeatmapStart(card, datesWithData, today)
  const daysFromMonday = card.dateRange === '7' ? 0 : (start.getDay() === 0 ? 6 : start.getDay() - 1)
  const paddedStart = subDays(start, daysFromMonday)
  return eachDayOfInterval({ start: paddedStart, end: today }).map(day => format(day, 'yyyy-MM-dd'))
}

// Rescales every series to 0-100 % of its own peak so series with very different units
// (metres next to hours) can share one axis. The original numbers stay on each point under
// `__raw` so tooltips can still show them.
export function normalizeSeries(data, keys) {
  const peaks = new Map(keys.map(key => [
    key,
    data.reduce((peak, point) => Math.max(peak, Math.abs(Number(point[key]) || 0)), 0)
  ]))
  return data.map(point => {
    const next = { ...point, __raw: {} }
    for (const key of keys) {
      const value = Number(point[key]) || 0
      const peak = peaks.get(key)
      next.__raw[key] = value
      next[key] = peak > 0 ? Number(((value / peak) * 100).toFixed(2)) : 0
    }
    return next
  })
}
