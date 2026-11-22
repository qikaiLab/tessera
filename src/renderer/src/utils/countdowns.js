import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isSameDay,
  isValid,
  parseISO,
  startOfDay
} from 'date-fns'

// Countdown days: the dates that count down (or up) to something, optionally repeating every N
// weeks, months or years. Pure logic; the calendar page and its drawer draw it.

export const COUNTDOWN_COLORS = Object.freeze(['#7c6aff', '#34d399', '#f87171', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'])
export const REPEAT_UNITS = Object.freeze(['week', 'month', 'year'])
export const MAX_REPEAT_EVERY = 99
export const MAX_NAME_LENGTH = 60
export const MAX_NOTE_LENGTH = 200
// Days outside this range are mistakes (a half-typed year in the date field), not dates to count to.
export const MIN_DATE = '1900-01-01'
export const MAX_DATE = '2200-12-31'

// ─── Days and their wording ────────────────────────────────────────────────

// Whole calendar days from `now` until the countdown's date (negative once it has passed), or null
// when the date cannot be read. Calendar days, not elapsed hours: on a 23 h or 25 h day (clock
// changes) dividing milliseconds by 24 h is a day off for the hour around midnight.
export function daysUntil(dateStr, now = new Date()) {
  const target = parseISO(dateStr)
  return isValid(target) ? differenceInCalendarDays(target, now) : null
}

// "还有 N 天" / "今天！" / "已过 N 天"; nothing for a number of days that cannot be read.
export function describeDays(diff) {
  if (diff === null || diff === undefined) return ''
  if (diff > 0) return `还有 ${diff} 天`
  if (diff === 0) return '今天！'
  return `已过 ${-diff} 天`
}

export function describeCountdown(dateStr, now = new Date()) {
  return describeDays(daysUntil(dateStr, now))
}

// ─── Repeating ─────────────────────────────────────────────────────────────

/** A stored repeat setting as { unit, every }, or null for "does not repeat" (and for anything unreadable). */
export function normalizeRepeat(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!REPEAT_UNITS.includes(raw.unit)) return null
  const every = Math.floor(Number(raw.every))
  return { unit: raw.unit, every: Number.isFinite(every) && every >= 1 ? Math.min(every, MAX_REPEAT_EVERY) : 1 }
}

export function describeRepeat(repeat) {
  if (!repeat) return ''
  const { unit, every } = repeat
  if (unit === 'week') return every === 1 ? '每周' : `每 ${every} 周`
  if (unit === 'month') return every === 1 ? '每月' : `每 ${every} 个月`
  return every === 1 ? '每年' : `每 ${every} 年`
}

const parseDay = (value) => {
  if (typeof value !== 'string') return null
  const day = parseISO(value)
  return isValid(day) ? day : null
}

const monthsPerStep = ({ unit, every }) => (unit === 'year' ? 12 * every : every)

// The index-th occurrence (0 is the date itself). Counted from the first date each time, never from
// the previous occurrence, so a month-end date keeps its day (31 Jan, 28 Feb, 31 Mar).
function occurrenceAt(base, repeat, index) {
  if (repeat.unit === 'week') return addDays(base, 7 * repeat.every * index)
  return addMonths(base, monthsPerStep(repeat) * index)
}

/** Whether a countdown (as read by readCountdown) falls on the given day. */
export function occursOn(countdown, day) {
  const base = countdown?.baseDay
  if (!base || !isValid(day)) return false
  const { repeat } = countdown
  if (!repeat) return isSameDay(base, day)
  if (day < startOfDay(base)) return false
  if (repeat.unit === 'week') return differenceInCalendarDays(day, base) % (7 * repeat.every) === 0
  const months = differenceInCalendarMonths(day, base)
  const step = monthsPerStep(repeat)
  if (months % step !== 0) return false
  return isSameDay(occurrenceAt(base, repeat, months / step), day)
}

/**
 * The first occurrence on or after today: { day, index }, where index counts the repeats since the
 * date itself. Null when the date cannot be read. A countdown that does not repeat has just its one.
 */
export function nextOccurrence(countdown, now = new Date()) {
  const base = countdown?.baseDay
  if (!base) return null
  const { repeat } = countdown
  if (!repeat) return { day: base, index: 0 }
  const today = startOfDay(now)
  if (base >= today) return { day: base, index: 0 }

  let index
  if (repeat.unit === 'week') {
    index = Math.ceil(differenceInCalendarDays(today, base) / (7 * repeat.every))
  } else {
    index = Math.max(0, Math.floor(differenceInCalendarMonths(today, base) / monthsPerStep(repeat)))
  }
  // The estimate can be one step off around month ends; settle it.
  for (let guard = 0; guard < 4 && occurrenceAt(base, repeat, index) < today; guard += 1) index += 1
  for (let guard = 0; guard < 4 && index > 0 && occurrenceAt(base, repeat, index - 1) >= today; guard += 1) index -= 1
  const day = occurrenceAt(base, repeat, index)
  return isValid(day) ? { day, index } : null
}

// "第 3 个周年" for a yearly repeat, "第 5 次" for the others; nothing for the first occurrence.
export function describeMilestone(repeat, index) {
  if (!repeat || index < 1) return ''
  return repeat.unit === 'year' ? `第 ${index * repeat.every} 个周年` : `第 ${index + 1} 次`
}

/**
 * Where a countdown stands: { valid, day, date, days, text, ended, milestone }. A repeating
 * countdown always looks ahead to its next occurrence; one that does not is "ended" once passed.
 */
export function countdownStatus(countdown, now = new Date()) {
  const next = nextOccurrence(countdown, now)
  if (!next) return { valid: false, ended: false, days: null, text: '', milestone: '', day: null, date: '' }
  const days = differenceInCalendarDays(next.day, now)
  return {
    valid: true,
    day: next.day,
    date: format(next.day, 'yyyy-MM-dd'),
    days,
    text: describeDays(days),
    ended: !countdown.repeat && days < 0,
    milestone: describeMilestone(countdown.repeat, next.index)
  }
}

// ─── Reading what is stored ────────────────────────────────────────────────

const COLOR = /^#[0-9a-fA-F]{3,8}$/
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * Stable identity of every item of a stored list: its id when it has a usable, unique one, else its
 * position. (A hand-edited file can lack ids or repeat them; the page must still work with it.)
 */
export function keyCountdowns(list) {
  const seen = new Set()
  return (Array.isArray(list) ? list : []).map((item, index) => {
    const id = isObject(item) ? item.id : undefined
    const usable = (typeof id === 'string' && id !== '') || (typeof id === 'number' && Number.isFinite(id))
    const key = usable ? `id:${id}` : `index:${index}`
    if (seen.has(key)) return `index:${index}`
    seen.add(key)
    return key
  })
}

/** One stored countdown as the page uses it. Never throws, whatever the file holds. */
export function readCountdown(raw, key) {
  const item = isObject(raw) ? raw : {}
  const date = typeof item.date === 'string' ? item.date : ''
  return {
    key,
    name: typeof item.name === 'string' ? item.name : '',
    date,
    baseDay: parseDay(date),
    color: typeof item.color === 'string' && COLOR.test(item.color) ? item.color : null,
    repeat: normalizeRepeat(item.repeat),
    note: typeof item.note === 'string' ? item.note : ''
  }
}

export function readCountdowns(list) {
  const items = Array.isArray(list) ? list : []
  const keys = keyCountdowns(items)
  return items.map((raw, index) => readCountdown(raw, keys[index]))
}

/** The countdowns that fall on a day. */
export function countdownsOn(countdowns, day) {
  return countdowns.filter(countdown => occursOn(countdown, day))
}

/**
 * The list as the drawer shows it: what is still ahead (nearest first), what has ended (latest
 * first) and what has a date nobody can read.
 */
export function groupCountdowns(countdowns, now = new Date()) {
  const upcoming = []
  const ended = []
  const unreadable = []
  for (const countdown of countdowns) {
    const status = countdownStatus(countdown, now)
    if (!status.valid) unreadable.push({ countdown, status })
    else if (status.ended) ended.push({ countdown, status })
    else upcoming.push({ countdown, status })
  }
  upcoming.sort((a, b) => a.status.days - b.status.days)
  ended.sort((a, b) => b.status.days - a.status.days)
  return { upcoming, ended, unreadable }
}

// ─── Changing the stored list (each returns a new list) ────────────────────

/** An id no item uses: the time, and always above any numeric id already there. */
export function nextCountdownId(list) {
  let highest = 0
  for (const item of Array.isArray(list) ? list : []) {
    const id = isObject(item) ? Number(item.id) : NaN
    if (Number.isFinite(id) && id > highest) highest = id
  }
  return Math.max(Date.now(), highest + 1)
}

export function validateName(value) {
  const name = String(value ?? '').trim()
  if (!name) return '请填写倒数日名称'
  if (name.length > MAX_NAME_LENGTH) return `名称不超过 ${MAX_NAME_LENGTH} 个字`
  return ''
}

export function validateDate(value) {
  const text = String(value ?? '')
  if (!text) return '请选择日期'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !parseDay(text)) return '日期无效'
  if (text < MIN_DATE || text > MAX_DATE) return '日期超出范围'
  return ''
}

function applyFields(target, patch) {
  if ('name' in patch) target.name = String(patch.name).trim().slice(0, MAX_NAME_LENGTH)
  if ('date' in patch) target.date = patch.date
  if ('color' in patch && COLOR.test(String(patch.color))) target.color = patch.color
  if ('note' in patch) {
    const note = String(patch.note).slice(0, MAX_NOTE_LENGTH)
    if (note.trim()) target.note = note
    else delete target.note
  }
  if ('repeat' in patch) {
    const repeat = normalizeRepeat(patch.repeat)
    if (repeat) target.repeat = repeat
    else delete target.repeat
  }
  return target
}

/** The list with one more countdown from a draft { name, date, color, repeat, note }. */
export function addCountdown(list, draft) {
  const items = Array.isArray(list) ? list : []
  const fresh = applyFields({ id: nextCountdownId(items), color: COUNTDOWN_COLORS[0] }, draft)
  return [...items, fresh]
}

/** The list with the fields of `patch` changed on one item; everything else on it stays as it was. */
export function updateCountdown(list, key, patch) {
  const items = Array.isArray(list) ? list : []
  const at = keyCountdowns(items).indexOf(key)
  if (at < 0) return items
  return items.map((item, index) => (index === at ? applyFields({ ...(isObject(item) ? item : {}) }, patch) : item))
}

export function removeCountdown(list, key) {
  const items = Array.isArray(list) ? list : []
  const at = keyCountdowns(items).indexOf(key)
  return at < 0 ? items : items.filter((_, index) => index !== at)
}
