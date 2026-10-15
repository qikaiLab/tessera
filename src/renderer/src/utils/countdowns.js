import { parseISO } from 'date-fns'

const DAY_MS = 1000 * 60 * 60 * 24

// Whole days from `now` until the countdown's date (negative once it has passed).
export function daysUntil(dateStr, now = new Date()) {
  // `|| 0` turns the -0 of a date earlier today into a plain 0.
  return Math.ceil((parseISO(dateStr) - now) / DAY_MS) || 0
}

// "还有 N 天" / "今天！" / "已过 N 天"
export function describeCountdown(dateStr, now = new Date()) {
  const diff = daysUntil(dateStr, now)
  if (diff > 0) return `还有 ${diff} 天`
  if (diff === 0) return '今天！'
  return `已过 ${-diff} 天`
}
