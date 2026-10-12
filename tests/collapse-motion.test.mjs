import { describe, expect, it } from 'vitest'
import {
  COLLAPSE_MAX_MS,
  COLLAPSE_MIN_MS,
  collapseDurationMs
} from '../src/renderer/src/utils/collapseMotion'

describe('collapseDurationMs', () => {
  it('stays within the limits for any height', () => {
    expect(collapseDurationMs(0)).toBe(COLLAPSE_MIN_MS)
    expect(collapseDurationMs(20)).toBe(COLLAPSE_MIN_MS)
    expect(collapseDurationMs(100000)).toBe(COLLAPSE_MAX_MS)
  })

  it('grows with the distance travelled', () => {
    const short = collapseDurationMs(140)
    const medium = collapseDurationMs(500)
    const long = collapseDurationMs(900)
    expect(short).toBeLessThan(medium)
    expect(medium).toBeLessThan(long)
  })

  it('treats unusable measurements as the shortest duration', () => {
    expect(collapseDurationMs(NaN)).toBe(COLLAPSE_MIN_MS)
    expect(collapseDurationMs(undefined)).toBe(COLLAPSE_MIN_MS)
    expect(collapseDurationMs(-50)).toBe(COLLAPSE_MIN_MS)
  })
})
