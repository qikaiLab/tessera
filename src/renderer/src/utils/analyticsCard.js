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
