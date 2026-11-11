import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { daysUntil, describeCountdown } from '../src/renderer/src/utils/countdowns.js'

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
