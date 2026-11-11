import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'

// Whole calendar days from `now` until the countdown's date (negative once it has passed), or null
// when the date cannot be read. Calendar days, not elapsed hours: on a 23 h or 25 h day (clock
// changes) dividing milliseconds by 24 h is a day off for the hour around midnight.
export function daysUntil(dateStr, now = new Date()) {
  const target = parseISO(dateStr)
  return isValid(target) ? differenceInCalendarDays(target, now) : null
}

// "还有 N 天" / "今天！" / "已过 N 天"; nothing for a date that cannot be read.
export function describeCountdown(dateStr, now = new Date()) {
  const diff = daysUntil(dateStr, now)
  if (diff === null) return ''
  if (diff > 0) return `还有 ${diff} 天`
  if (diff === 0) return '今天！'
  return `已过 ${-diff} 天`
}
