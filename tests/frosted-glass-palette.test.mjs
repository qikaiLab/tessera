import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FROSTED_PALETTE,
  deriveAdaptiveFrostedPalette
} from '../src/renderer/src/theme/frostedGlassPalette.js'

function pixels(red, green, blue, count = 64) {
  return Uint8ClampedArray.from(
    Array.from({ length: count }, () => [red, green, blue, 255]).flat()
  )
}

describe('Frosted Glass adaptive palette', () => {
  it('adapts to strongly colored red, green, and blue backgrounds', () => {
    const redHue = deriveAdaptiveFrostedPalette(pixels(196, 42, 48)).hue
    expect(redHue < 15 || redHue > 345).toBe(true)
    expect(deriveAdaptiveFrostedPalette(pixels(34, 166, 88)).hue).toBeGreaterThan(120)
    expect(deriveAdaptiveFrostedPalette(pixels(34, 92, 196)).hue).toBeGreaterThan(210)
  })

  it('clamps saturation for readable accents', () => {
    expect(deriveAdaptiveFrostedPalette(pixels(255, 0, 0)).saturation).toBe(78)
  })

  it('uses a stable fallback for neutral backgrounds', () => {
    expect(deriveAdaptiveFrostedPalette(pixels(128, 128, 128))).toEqual(DEFAULT_FROSTED_PALETTE)
  })
})
