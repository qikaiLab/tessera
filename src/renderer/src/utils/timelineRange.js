import { endOfMonth, format, startOfMonth, startOfYear, subDays } from 'date-fns'

export const RANGE_PRESETS = [
  { value: '7', label: '近 7 天' },
  { value: '30', label: '近 30 天' },
  { value: '90', label: '近 90 天' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '今年' },
  { value: 'all', label: '全部时间' }
]

const toInputValue = date => format(date, 'yyyy-MM-dd')

// Date range (as yyyy-MM-dd strings for <input type="date">) for a quick-pick preset.
export function getPresetRange(presetId, today = new Date()) {
  switch (presetId) {
    case '7':
    case '30':
    case '90':
      return { from: toInputValue(subDays(today, Number(presetId) - 1)), to: toInputValue(today) }
    case 'month':
      return { from: toInputValue(startOfMonth(today)), to: toInputValue(endOfMonth(today)) }
    case 'year':
      return { from: toInputValue(startOfYear(today)), to: toInputValue(today) }
    default:
      return { from: '', to: '' }
  }
}

function formatEdge(value, today) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return year === today.getFullYear() ? `${month}月${day}日` : `${year}/${month}/${day}`
}

// Short label for the range button, e.g. "全部时间" or "5月1日 – 5月17日".
export function formatRangeLabel(from, to, today = new Date()) {
  if (from && to) return `${formatEdge(from, today)} – ${formatEdge(to, today)}`
  if (from) return `${formatEdge(from, today)} 起`
  if (to) return `截至 ${formatEdge(to, today)}`
  return '全部时间'
}
