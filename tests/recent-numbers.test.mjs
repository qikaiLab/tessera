import { describe, expect, it } from 'vitest'
import { findRecentNumberValues } from '../src/renderer/src/utils/recentNumbers.js'

// A history with `count` days ending 2026-10-31 (day 1 = 2026-10-01 is the oldest of those used here).
function historyOf(entries) {
  const reads = []
  const readDay = async (date) => {
    reads.push(date)
    return entries[date] || {}
  }
  return { readDay, reads, dates: Object.keys(entries) }
}

describe('findRecentNumberValues', () => {
  it('takes the latest earlier value for each section, ignoring the day itself and later days', async () => {
    const { readDay, dates } = historyOf({
      '2026-10-01': { weight: { value: '70' }, sleep: { value: '6' } },
      '2026-10-03': { weight: { value: '71' } },
      '2026-10-05': { weight: { value: '99' } },
      '2026-10-06': { sleep: { value: '1' } }
    })
    const found = await findRecentNumberValues({ dates, before: '2026-10-05', sectionIds: ['weight', 'sleep'], readDay })
    expect(found).toEqual({ weight: '71', sleep: '6' })
  })

  it('leaves out sections that were never recorded, and answers an empty history', async () => {
    const { readDay, dates } = historyOf({ '2026-10-01': { weight: { value: '70' } } })
    expect(await findRecentNumberValues({ dates, before: '2026-10-05', sectionIds: ['weight', 'height'], readDay }))
      .toEqual({ weight: '70' })
    expect(await findRecentNumberValues({ dates: [], before: '2026-10-05', sectionIds: ['weight'], readDay })).toEqual({})
  })

  it('does not read further back than it needs to', async () => {
    const entries = {}
    for (let day = 1; day <= 200; day += 1) entries[`2025-${String(Math.ceil(day / 28)).padStart(2, '0')}-${String(((day - 1) % 28) + 1).padStart(2, '0')}`] = {}
    const dates = Object.keys(entries).sort()
    entries[dates.at(-3)] = { weight: { value: '65' } }
    const { readDay, reads } = historyOf(entries)
    const found = await findRecentNumberValues({ dates, before: '2026-01-01', sectionIds: ['weight'], readDay, chunkSize: 10 })
    expect(found).toEqual({ weight: '65' })
    // The hit is in the newest chunk of 10: nothing older is read.
    expect(reads.length).toBe(10)
  })

  it('reads the history once for several sections, in parallel chunks', async () => {
    const entries = {}
    for (let day = 1; day <= 100; day += 1) entries[`2026-${String(Math.ceil(day / 28)).padStart(2, '0')}-${String(((day - 1) % 28) + 1).padStart(2, '0')}`] = {}
    const dates = Object.keys(entries)
    let inFlight = 0
    let peak = 0
    const readDay = async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise(resolve => setTimeout(resolve, 1))
      inFlight -= 1
      return {}
    }
    const counted = []
    const found = await findRecentNumberValues({
      dates, before: '2027-01-01', sectionIds: ['a', 'b', 'c'], readDay: (date) => { counted.push(date); return readDay() }, chunkSize: 24
    })
    expect(found).toEqual({})
    // Every day exactly once (not once per section), and several at the same time.
    expect(counted).toHaveLength(dates.length)
    expect(new Set(counted).size).toBe(dates.length)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(24)
  })

  it('does not take an empty or unreadable day for a value', async () => {
    const { readDay, dates } = historyOf({
      '2026-10-01': { weight: { value: '70' } },
      '2026-10-02': { weight: { value: '' } },
      '2026-10-03': null
    })
    expect(await findRecentNumberValues({ dates, before: '2026-10-05', sectionIds: ['weight'], readDay })).toEqual({ weight: '70' })
  })
})
