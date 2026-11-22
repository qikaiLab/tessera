import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  COUNTDOWN_COLORS,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_REPEAT_EVERY,
  addCountdown,
  countdownStatus,
  countdownsOn,
  daysUntil,
  describeCountdown,
  describeMilestone,
  describeRepeat,
  groupCountdowns,
  keyCountdowns,
  nextOccurrence,
  normalizeRepeat,
  occursOn,
  readCountdown,
  readCountdowns,
  removeCountdown,
  updateCountdown,
  validateDate,
  validateName
} from '../src/renderer/src/utils/countdowns.js'

const now = new Date(2026, 9, 13, 12, 0, 0)

describe('countdowns', () => {
  it('counts the days until a date, rounding partial days up', () => {
    expect(daysUntil('2026-10-14', now)).toBe(1)
    expect(daysUntil('2026-10-23', now)).toBe(10)
    expect(daysUntil('2026-10-13', now)).toBe(0)
    expect(daysUntil('2026-10-10', now)).toBe(-3)
  })

  it('describes upcoming, current and past dates', () => {
    expect(describeCountdown('2026-10-20', now)).toBe('还有 7 天')
    expect(describeCountdown('2026-10-13', now)).toBe('今天！')
    expect(describeCountdown('2026-10-01', now)).toBe('已过 12 天')
  })

  describe('around a clock change', () => {
    const previousZone = process.env.TZ
    beforeAll(() => { process.env.TZ = 'America/New_York' })
    afterAll(() => {
      if (previousZone === undefined) delete process.env.TZ
      else process.env.TZ = previousZone
    })

    it('counts calendar days, not elapsed 24-hour periods', () => {
      // The zone must really change its clocks, or this test proves nothing.
      expect(new Date(2026, 2, 9).getTimezoneOffset()).not.toBe(new Date(2026, 2, 7).getTimezoneOffset())
      // 23:15 the evening before a 23 h day / 23:30 on a 25 h day: elapsed hours would be a day off.
      expect(daysUntil('2026-03-09', new Date(2026, 2, 7, 23, 15))).toBe(2)
      expect(daysUntil('2026-11-01', new Date(2026, 10, 1, 23, 30))).toBe(0)
      expect(daysUntil('2026-11-01', new Date(2026, 10, 3, 23, 45))).toBe(-2)
      expect(daysUntil('2026-10-14', new Date(2026, 9, 13, 23, 59, 59))).toBe(1)
      expect(daysUntil('2026-10-13', new Date(2026, 9, 13, 0, 0, 1))).toBe(0)
    })
  })

  it('shows nothing for a date it cannot read instead of calling it today', () => {
    expect(daysUntil('not-a-date', now)).toBeNull()
    expect(daysUntil('', now)).toBeNull()
    expect(describeCountdown('not-a-date', now)).toBe('')
  })
})

// ─── Repeating, reading and editing the stored list ─────────────────────────

const read = (item, key = 'k') => readCountdown(item, key)
const day = (text) => new Date(`${text}T00:00:00`)
const on = (item, text) => occursOn(read(item), day(text))
const iso = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

describe('repeat settings', () => {
  it('reads a repeat as a unit and a step, and anything else as "does not repeat"', () => {
    expect(normalizeRepeat({ unit: 'year', every: 1 })).toEqual({ unit: 'year', every: 1 })
    expect(normalizeRepeat({ unit: 'week', every: '3' })).toEqual({ unit: 'week', every: 3 })
    expect(normalizeRepeat({ unit: 'month', every: 2.9 })).toEqual({ unit: 'month', every: 2 })
    // A missing, zero, negative or absurd step becomes a sensible one.
    expect(normalizeRepeat({ unit: 'month' })).toEqual({ unit: 'month', every: 1 })
    expect(normalizeRepeat({ unit: 'month', every: 0 })).toEqual({ unit: 'month', every: 1 })
    expect(normalizeRepeat({ unit: 'month', every: -4 })).toEqual({ unit: 'month', every: 1 })
    expect(normalizeRepeat({ unit: 'week', every: 100000 })).toEqual({ unit: 'week', every: MAX_REPEAT_EVERY })
    for (const bad of [undefined, null, 5, 'year', [], { unit: 'day', every: 1 }, { unit: '__proto__' }, { every: 2 }]) {
      expect(normalizeRepeat(bad)).toBeNull()
    }
  })

  it('words them the way people say them', () => {
    expect(describeRepeat({ unit: 'week', every: 1 })).toBe('每周')
    expect(describeRepeat({ unit: 'week', every: 2 })).toBe('每 2 周')
    expect(describeRepeat({ unit: 'month', every: 1 })).toBe('每月')
    expect(describeRepeat({ unit: 'month', every: 3 })).toBe('每 3 个月')
    expect(describeRepeat({ unit: 'year', every: 1 })).toBe('每年')
    expect(describeRepeat({ unit: 'year', every: 5 })).toBe('每 5 年')
    expect(describeRepeat(null)).toBe('')
  })
})

describe('which days a countdown falls on', () => {
  it('a countdown that does not repeat falls on its own day only', () => {
    const item = { date: '2026-12-12' }
    expect(on(item, '2026-12-12')).toBe(true)
    expect(on(item, '2026-12-13')).toBe(false)
    expect(on(item, '2027-12-12')).toBe(false)
    expect(on({ date: 'not-a-date' }, '2026-12-12')).toBe(false)
  })

  it('every N weeks keeps the weekday, and starts at the date itself', () => {
    const item = { date: '2026-11-02', repeat: { unit: 'week', every: 2 } }
    expect(['2026-11-02', '2026-11-16', '2026-11-30', '2027-01-11'].map(text => on(item, text))).toEqual([true, true, true, true])
    expect(['2026-11-09', '2026-11-03', '2026-11-23'].map(text => on(item, text))).toEqual([false, false, false])
    // Never before the date it starts from.
    expect(on(item, '2026-10-19')).toBe(false)
  })

  it('every N months keeps the day of the month, and a short month takes its last day', () => {
    const monthly = { date: '2026-01-31', repeat: { unit: 'month', every: 1 } }
    expect(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2028-02-29'].map(text => on(monthly, text))).toEqual([true, true, true, true, true])
    expect(['2026-02-27', '2026-03-01', '2026-04-29'].map(text => on(monthly, text))).toEqual([false, false, false])

    const quarterly = { date: '2026-01-15', repeat: { unit: 'month', every: 3 } }
    expect(['2026-04-15', '2026-07-15', '2027-01-15'].map(text => on(quarterly, text))).toEqual([true, true, true])
    expect(['2026-02-15', '2026-03-15', '2026-05-15'].map(text => on(quarterly, text))).toEqual([false, false, false])
  })

  it('every N years keeps the date, and 29 February falls on 28 February in other years', () => {
    const birthday = { date: '1990-05-20', repeat: { unit: 'year', every: 1 } }
    expect(['1990-05-20', '2026-05-20', '2099-05-20'].map(text => on(birthday, text))).toEqual([true, true, true])
    expect(['2026-05-19', '2026-06-20', '1989-05-20'].map(text => on(birthday, text))).toEqual([false, false, false])

    const leap = { date: '2024-02-29', repeat: { unit: 'year', every: 1 } }
    expect(['2025-02-28', '2026-02-28', '2028-02-29'].map(text => on(leap, text))).toEqual([true, true, true])
    expect(['2025-03-01', '2026-02-27'].map(text => on(leap, text))).toEqual([false, false])

    const everyFive = { date: '2020-03-01', repeat: { unit: 'year', every: 5 } }
    expect(['2025-03-01', '2030-03-01'].map(text => on(everyFive, text))).toEqual([true, true])
    expect(['2021-03-01', '2024-03-01'].map(text => on(everyFive, text))).toEqual([false, false])
  })
})

describe('the next occurrence and where a countdown stands', () => {
  // A Sunday afternoon.
  const today = new Date(2026, 10, 22, 15, 30)
  const next = (item) => {
    const found = nextOccurrence(read(item), today)
    return found && { date: iso(found.day), index: found.index }
  }

  it('is the date itself while it is still ahead, or today', () => {
    expect(next({ date: '2026-12-12', repeat: { unit: 'year', every: 1 } })).toEqual({ date: '2026-12-12', index: 0 })
    expect(next({ date: '2026-11-22', repeat: { unit: 'week', every: 1 } })).toEqual({ date: '2026-11-22', index: 0 })
  })

  it('rolls a repeating countdown forward to the next time it comes round', () => {
    expect(next({ date: '2020-11-28', repeat: { unit: 'year', every: 1 } })).toEqual({ date: '2026-11-28', index: 6 })
    expect(next({ date: '2020-11-21', repeat: { unit: 'year', every: 1 } })).toEqual({ date: '2027-11-21', index: 7 })
    expect(next({ date: '2026-10-05', repeat: { unit: 'week', every: 3 } })).toEqual({ date: '2026-12-07', index: 3 })
    expect(next({ date: '2026-01-31', repeat: { unit: 'month', every: 1 } })).toEqual({ date: '2026-11-30', index: 10 })
    expect(next({ date: '2025-11-22', repeat: { unit: 'month', every: 4 } })).toEqual({ date: '2026-11-22', index: 3 })
  })

  it('says nothing for a date it cannot read, and does not roll a countdown that does not repeat', () => {
    expect(nextOccurrence(read({ date: 'nope', repeat: { unit: 'year', every: 1 } }), today)).toBeNull()
    expect(next({ date: '2026-11-03' })).toEqual({ date: '2026-11-03', index: 0 })
  })

  it('counts the days, calls a passed one-off countdown ended, and never ends a repeating one', () => {
    expect(countdownStatus(read({ date: '2026-12-12' }), today)).toMatchObject({ valid: true, days: 20, text: '还有 20 天', ended: false, date: '2026-12-12' })
    expect(countdownStatus(read({ date: '2026-11-22' }), today)).toMatchObject({ days: 0, text: '今天！', ended: false })
    expect(countdownStatus(read({ date: '2026-11-03' }), today)).toMatchObject({ days: -19, text: '已过 19 天', ended: true })
    expect(countdownStatus(read({ date: '2000-11-28', repeat: { unit: 'year', every: 1 } }), today))
      .toMatchObject({ days: 6, ended: false, milestone: '第 26 个周年' })
    expect(countdownStatus(read({ date: '' }), today)).toMatchObject({ valid: false, text: '' })
  })

  it('names the occurrence: an anniversary for years, a count for weeks and months', () => {
    expect(describeMilestone({ unit: 'year', every: 1 }, 0)).toBe('')
    expect(describeMilestone({ unit: 'year', every: 1 }, 3)).toBe('第 3 个周年')
    expect(describeMilestone({ unit: 'year', every: 5 }, 2)).toBe('第 10 个周年')
    expect(describeMilestone({ unit: 'month', every: 2 }, 4)).toBe('第 5 次')
    expect(describeMilestone(null, 4)).toBe('')
  })

  it('groups what is ahead (nearest first), what has ended (latest first) and what cannot be read', () => {
    const list = readCountdowns([
      { id: 1, name: '远', date: '2027-01-06' },
      { id: 2, name: '近', date: '2026-11-28' },
      { id: 3, name: '早', date: '2026-10-01' },
      { id: 4, name: '刚过', date: '2026-11-20' },
      { id: 5, name: '坏', date: 'x' },
      { id: 6, name: '生日', date: '2000-11-25', repeat: { unit: 'year', every: 1 } }
    ])
    const { upcoming, ended, unreadable } = groupCountdowns(list, today)
    expect(upcoming.map(entry => entry.countdown.name)).toEqual(['生日', '近', '远'])
    expect(ended.map(entry => entry.countdown.name)).toEqual(['刚过', '早'])
    expect(unreadable.map(entry => entry.countdown.name)).toEqual(['坏'])
  })

  it('finds the countdowns on a day, repeats included', () => {
    const list = readCountdowns([
      { id: 1, name: '交付', date: '2026-11-28' },
      { id: 2, name: '纪念日', date: '2024-11-28', repeat: { unit: 'year', every: 1 } },
      { id: 3, name: '周会', date: '2026-11-02', repeat: { unit: 'week', every: 1 } }
    ])
    expect(countdownsOn(list, day('2026-11-28')).map(item => item.name)).toEqual(['交付', '纪念日'])
    expect(countdownsOn(list, day('2027-11-28')).map(item => item.name)).toEqual(['纪念日'])
    expect(countdownsOn(list, day('2026-11-23')).map(item => item.name)).toEqual(['周会'])
    expect(countdownsOn(list, day('2026-11-24'))).toEqual([])
  })
})

describe('reading a stored list that is not what it should be', () => {
  it('never throws, and keeps every entry listed', () => {
    const stored = [null, 7, 'text', [], { id: 'c-bad', title: '坏日期', date: 'not-a-date' }, { id: 1, name: 5, date: 9, color: 'red; x', repeat: 'daily', note: {} }]
    const list = readCountdowns(stored)
    expect(list).toHaveLength(stored.length)
    expect(list.every(item => item.baseDay === null)).toBe(true)
    expect(list.at(-1)).toMatchObject({ name: '', date: '', color: null, repeat: null, note: '' })
    expect(readCountdowns(undefined)).toEqual([])
    expect(readCountdowns({ id: 1 })).toEqual([])
  })

  it('identifies items by id, and by position when an id is missing or repeated', () => {
    expect(keyCountdowns([{ id: 1 }, { id: 'a' }, {}, { id: 1 }, null, { id: '' }, { id: NaN }])).toEqual(
      ['id:1', 'id:a', 'index:2', 'index:3', 'index:4', 'index:5', 'index:6']
    )
  })

  it('only accepts colours that are colours', () => {
    expect(read({ color: '#34d399' }).color).toBe('#34d399')
    expect(read({ color: '#fff' }).color).toBe('#fff')
    for (const bad of ['red', 'url(x)', '#12', '#zzzzzz', 4, null]) expect(read({ color: bad }).color).toBeNull()
  })
})

describe('editing the stored list', () => {
  const stored = [
    { id: 1, name: '旅行', date: '2026-12-01', color: '#34d399', extra: 'kept' },
    { id: 2, name: '考试', date: '2026-12-12', color: '#f87171', repeat: { unit: 'year', every: 1 }, note: '带笔' }
  ]

  it('adds a countdown with a fresh id and only the fields that are set', () => {
    const next = addCountdown(stored, { name: '  生日  ', date: '2027-03-01', color: '#60a5fa', repeat: { unit: 'month', every: 2 }, note: '' })
    expect(next).toHaveLength(3)
    expect(stored).toHaveLength(2)
    expect(next[2]).toEqual({ id: expect.any(Number), name: '生日', date: '2027-03-01', color: '#60a5fa', repeat: { unit: 'month', every: 2 } })
    expect(next[2].id).toBeGreaterThan(2)
    expect(addCountdown([], { name: 'x', date: '2027-01-01' })[0].color).toBe(COUNTDOWN_COLORS[0])
    // An id is never reused, even when the clock gives an old number.
    const high = [{ id: Date.now() + 10_000 }]
    expect(addCountdown(high, { name: 'x', date: '2027-01-01' })[1].id).toBeGreaterThan(high[0].id)
  })

  it('changes only the given fields of one item, and keeps what it does not know about', () => {
    const next = updateCountdown(stored, 'id:1', { name: ' 长途旅行 ', date: '2026-12-05' })
    expect(next[0]).toEqual({ id: 1, name: '长途旅行', date: '2026-12-05', color: '#34d399', extra: 'kept' })
    expect(next[1]).toBe(stored[1])
    expect(stored[0].name).toBe('旅行')
  })

  it('sets and clears the repeat and the note', () => {
    const repeated = updateCountdown(stored, 'id:1', { repeat: { unit: 'week', every: '2' } })
    expect(repeated[0].repeat).toEqual({ unit: 'week', every: 2 })
    expect('repeat' in updateCountdown(repeated, 'id:1', { repeat: null })[0]).toBe(false)
    expect('note' in updateCountdown(stored, 'id:2', { note: '   ' })[1]).toBe(false)
    expect(updateCountdown(stored, 'id:2', { note: 'x'.repeat(500) })[1].note).toHaveLength(MAX_NOTE_LENGTH)
    expect(updateCountdown(stored, 'id:2', { color: 'javascript:1' })[1].color).toBe('#f87171')
  })

  it('removes one item, and ignores a key that is not there', () => {
    expect(removeCountdown(stored, 'id:1').map(item => item.id)).toEqual([2])
    expect(removeCountdown(stored, 'id:9')).toBe(stored)
    expect(updateCountdown(stored, 'id:9', { name: 'x' })).toBe(stored)
  })

  it('works on an item that has no id, by position', () => {
    const odd = [{ name: '无编号', date: '2026-12-01' }, null]
    expect(updateCountdown(odd, 'index:0', { name: '有名字' })[0].name).toBe('有名字')
    expect(updateCountdown(odd, 'index:1', { name: '补上' })[1]).toMatchObject({ name: '补上' })
    expect(removeCountdown(odd, 'index:1')).toEqual([odd[0]])
  })

  it('checks a name and a date the way the drawer asks for them', () => {
    expect(validateName('  ')).toBe('请填写倒数日名称')
    expect(validateName('考试')).toBe('')
    expect(validateName('字'.repeat(MAX_NAME_LENGTH + 1))).not.toBe('')
    expect(validateDate('')).toBe('请选择日期')
    expect(validateDate('2026-02-30')).toBe('日期无效')
    expect(validateDate('20260101')).toBe('日期无效')
    expect(validateDate('0202-05-01')).toBe('日期超出范围')
    expect(validateDate('2026-12-12')).toBe('')
  })
})
