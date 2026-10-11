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
