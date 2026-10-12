import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FROSTED_PALETTE,
  analyzePixels,
  deriveAdaptiveFrostedPalette
} from '../src/renderer/src/theme/frostedGlassPalette.js'

function pixels(red, green, blue, count = 64) {
  return Uint8ClampedArray.from(
    Array.from({ length: count }, () => [red, green, blue, 255]).flat()
  )
}

// A photo made of several flat patches: [[r, g, b], share of the pixels].
function mixed(patches, count = 400) {
  const data = []
  for (const [color, share] of patches) {
    for (let index = 0; index < Math.round(count * share); index += 1) data.push([...color, 255])
  }
  return Uint8ClampedArray.from(data.flat())
}

describe('Frosted Glass adaptive palette', () => {
  it('adapts to strongly colored red, green, and blue backgrounds', () => {
    const redHue = deriveAdaptiveFrostedPalette(pixels(196, 42, 48)).hue
    expect(redHue < 15 || redHue > 345).toBe(true)
    expect(deriveAdaptiveFrostedPalette(pixels(34, 166, 88)).hue).toBeGreaterThan(120)
    expect(deriveAdaptiveFrostedPalette(pixels(34, 92, 196)).hue).toBeGreaterThan(210)
  })

  it('keeps the accent readable but never beyond a sane saturation', () => {
    const vivid = deriveAdaptiveFrostedPalette(pixels(255, 0, 0))
    expect(vivid.saturation).toBeLessThanOrEqual(76)
    expect(vivid.saturation).toBeGreaterThanOrEqual(46)
    expect(vivid.tintSaturation).toBe(62)
  })

  it('tints the glass strongly for vivid photos', () => {
    expect(deriveAdaptiveFrostedPalette(pixels(210, 40, 160)).tintSaturation).toBeGreaterThan(55)
  })

  it('does not tint the glass for neutral photos', () => {
    for (const grey of [18, 90, 128, 200]) {
      const palette = deriveAdaptiveFrostedPalette(pixels(grey, grey, grey))
      expect(palette.hue).toBe(DEFAULT_FROSTED_PALETTE.hue)
      expect(palette.tintSaturation).toBeLessThanOrEqual(6)
    }
  })

  it('stays nearly neutral when a grey photo has only a few coloured lights', () => {
    // A rainy window at night: mostly grey, a handful of orange/red bokeh dots.
    const rainy = mixed([
      [[58, 58, 60], 0.5],
      [[96, 96, 98], 0.34],
      [[34, 34, 36], 0.1],
      [[226, 118, 52], 0.04],
      [[200, 80, 70], 0.02]
    ])
    const palette = deriveAdaptiveFrostedPalette(rainy)
    // Well under a vivid photo's 62, and the accent stays muted.
    expect(palette.tintSaturation).toBeLessThanOrEqual(14)
    expect(palette.saturation).toBeLessThanOrEqual(30)
  })

  it('moves smoothly: more colour never means less tint', () => {
    const tints = [0, 8, 16, 28, 44, 70].map(spread => {
      const [red, green, blue] = [120 + spread, 120, 120 - spread]
      return deriveAdaptiveFrostedPalette(pixels(red, green, blue)).tintSaturation
    })
    for (let index = 1; index < tints.length; index += 1) {
      expect(tints[index]).toBeGreaterThanOrEqual(tints[index - 1])
    }
    expect(tints[0]).toBeLessThan(tints[tints.length - 1])
  })

  it('adds a dimming scrim for very bright photos and a lightening one for very dark photos', () => {
    const bright = deriveAdaptiveFrostedPalette(pixels(236, 240, 248))
    expect(bright.darkScrim).toBeGreaterThan(0.15)
    expect(bright.lightScrim).toBe(0)

    const dark = deriveAdaptiveFrostedPalette(pixels(14, 14, 18))
    expect(dark.lightScrim).toBeGreaterThan(0.15)
    expect(dark.darkScrim).toBe(0)

    const middle = deriveAdaptiveFrostedPalette(pixels(120, 125, 140))
    expect(middle.darkScrim).toBe(0)
    expect(middle.lightScrim).toBe(0)
  })

  it('falls back to the default for empty or fully transparent input', () => {
    expect(deriveAdaptiveFrostedPalette(new Uint8ClampedArray(0))).toEqual(DEFAULT_FROSTED_PALETTE)
    const transparent = Uint8ClampedArray.from(Array.from({ length: 16 }, () => [200, 40, 40, 0]).flat())
    const palette = deriveAdaptiveFrostedPalette(transparent)
    expect(palette.hue).toBe(DEFAULT_FROSTED_PALETTE.hue)
    expect(palette.tintSaturation).toBeLessThanOrEqual(6)
  })

  it('measures colourfulness from mid-tones only', () => {
    // Near-black pixels with a colour cast are noise, not colour.
    expect(analyzePixels(pixels(10, 4, 4)).colorfulness).toBeLessThan(0.03)
    expect(analyzePixels(pixels(200, 40, 40)).colorfulness).toBeGreaterThan(0.3)
  })
})

describe('Frosted Glass stylesheet', () => {
  it('only lets accent colours, not glass surfaces, use the accent saturation', () => {
    const css = fs.readFileSync(new URL('../src/renderer/src/styles/global.css', import.meta.url), 'utf8')
    const accentTokens = /^\s*--(accent|accent-hover|accent-light|accent-light-hover|border-focus|tag-resident-border|selection-bg):/
    const offenders = css.split(/\r?\n/)
      .filter(line => line.includes('var(--frosted-accent-s)'))
      .filter(line => !accentTokens.test(line))
    expect(offenders).toEqual([])
  })
})
