import { describe, expect, it } from 'vitest'
import { createHeatmapScale, getHeatmapAlpha } from '../src/renderer/src/utils/heatmapScale.js'

const OUTLIER_VALUES = [30, 80, 10, 150, 320, 3800, 150, 55]

describe('createHeatmapScale', () => {
  it('keeps ordinary days distinguishable next to an extreme outlier', () => {
    const scale = createHeatmapScale(OUTLIER_VALUES)
    const ordinary = [10, 30, 55, 80, 150, 320].map(scale)
    for (let i = 1; i < ordinary.length; i += 1) {
      expect(ordinary[i] - ordinary[i - 1]).toBeGreaterThan(0.05)
    }
    // A linear scale would put every one of them below 0.1.
    expect(Math.max(...OUTLIER_VALUES.map(value => value / 3800).slice(0, 5))).toBeLessThan(0.1)
  })

  it('still marks the outlier as the hottest day', () => {
    const scale = createHeatmapScale(OUTLIER_VALUES)
    const hottest = Math.max(...OUTLIER_VALUES.map(scale))
    expect(scale(3800)).toBe(hottest)
    expect(scale(3800)).toBeGreaterThan(scale(320))
  })

  it('is monotonic and gives equal values the same shade', () => {
    const scale = createHeatmapScale(OUTLIER_VALUES)
    const sorted = [...new Set(OUTLIER_VALUES)].sort((a, b) => a - b).map(scale)
    expect([...sorted].sort((a, b) => a - b)).toEqual(sorted)
    expect(scale(150)).toBe(scale(150))
  })

  it('treats zero, negative and missing values as empty', () => {
    const scale = createHeatmapScale([0, -4, 5, 20])
    expect(scale(0)).toBe(0)
    expect(scale(-4)).toBe(0)
    expect(scale(Number.NaN)).toBe(0)
    expect(scale(20)).toBeGreaterThan(scale(5))
  })

  it('handles empty and single-valued data', () => {
    expect(createHeatmapScale([])(5)).toBe(0)
    expect(createHeatmapScale([0, 0])(0)).toBe(0)
    const flat = createHeatmapScale([0, 7, 7, 0, 7])
    expect(flat(7)).toBe(1)
    expect(flat(0)).toBe(0)
  })

  it('keeps every intensity within 0..1 and visible once converted to alpha', () => {
    const scale = createHeatmapScale(OUTLIER_VALUES)
    for (const value of OUTLIER_VALUES) {
      expect(scale(value)).toBeGreaterThan(0)
      expect(scale(value)).toBeLessThanOrEqual(1)
    }
    expect(getHeatmapAlpha(0)).toBeCloseTo(0.2)
    expect(getHeatmapAlpha(1)).toBeCloseTo(1)
  })
})
