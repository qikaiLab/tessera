import { describe, expect, it } from 'vitest'
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
})
