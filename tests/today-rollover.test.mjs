import { describe, expect, it } from 'vitest'
import { decideRollover } from '../src/renderer/src/context/useTodayRollover.js'

describe('midnight rollover', () => {
  const yesterday = new Date(2026, 10, 10)

  it('does nothing while it is still the same day', () => {
    expect(decideRollover({
      lastSeenToday: yesterday, now: new Date(2026, 10, 10, 23, 59, 59), selected: new Date(2026, 10, 10, 9)
    })).toBe('same-day')
  })

  it('moves on to the new day when the page was showing the old "today"', () => {
    expect(decideRollover({
      lastSeenToday: yesterday, now: new Date(2026, 10, 11, 0, 0, 5), selected: new Date(2026, 10, 10, 15, 30)
    })).toBe('advance')
  })

  it("leaves the user's own choice of another day alone", () => {
    expect(decideRollover({
      lastSeenToday: yesterday, now: new Date(2026, 10, 11, 0, 0, 5), selected: new Date(2026, 9, 3)
    })).toBe('keep')
  })

  it('also handles a laptop that slept for several days', () => {
    expect(decideRollover({
      lastSeenToday: yesterday, now: new Date(2026, 10, 14, 8), selected: new Date(2026, 10, 10)
    })).toBe('advance')
  })
})
