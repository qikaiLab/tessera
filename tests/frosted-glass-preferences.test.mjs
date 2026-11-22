import { describe, expect, it } from 'vitest'
import {
  FROSTED_BACKGROUND_BLUR,
  FROSTED_WALLPAPER_IDS,
  applyFrostedBackgroundBlur,
  normalizeFrostedBackgroundBlur,
  resolveFrostedWallpaperId
} from '../src/renderer/src/theme/frostedGlassPreferences.js'

describe('Frosted Glass preferences', () => {
  it('normalizes background blur to safe persisted steps', () => {
    expect(normalizeFrostedBackgroundBlur(undefined)).toBe(FROSTED_BACKGROUND_BLUR.DEFAULT)
    expect(normalizeFrostedBackgroundBlur(-4)).toBe(FROSTED_BACKGROUND_BLUR.MIN)
    expect(normalizeFrostedBackgroundBlur(9)).toBe(10)
    expect(normalizeFrostedBackgroundBlur(80)).toBe(FROSTED_BACKGROUND_BLUR.MAX)
  })

  it('resolves which wallpaper shows from the saved choice and the imported picture', () => {
    const { DEFAULT, DUSK, FOREST, OCEAN, CUSTOM } = FROSTED_WALLPAPER_IDS

    // A saved bundled wallpaper wins, with or without an imported picture.
    for (const id of [DEFAULT, DUSK, FOREST, OCEAN]) {
      expect(resolveFrostedWallpaperId(id, false)).toBe(id)
      expect(resolveFrostedWallpaperId(id, true)).toBe(id)
    }

    // The imported picture shows only while the file is there.
    expect(resolveFrostedWallpaperId(CUSTOM, true)).toBe(CUSTOM)
    expect(resolveFrostedWallpaperId(CUSTOM, false)).toBe(DEFAULT)

    // Nothing saved yet (an update from a version that only had the imported picture): keep what showed.
    expect(resolveFrostedWallpaperId(undefined, true)).toBe(CUSTOM)
    expect(resolveFrostedWallpaperId(undefined, false)).toBe(DEFAULT)

    // Damaged values never reach the page.
    for (const bad of [null, 7, '', 'sunrise', {}, ['dusk'], '__proto__']) {
      expect(resolveFrostedWallpaperId(bad, false)).toBe(DEFAULT)
      expect(resolveFrostedWallpaperId(bad, true)).toBe(CUSTOM)
    }
  })

  it('applies blur only through background-layer variables', () => {
    const properties = new Map()
    const attributes = new Map()
    const root = {
      style: { setProperty: (name, value) => properties.set(name, value) },
      setAttribute: (name, value) => attributes.set(name, value)
    }

    expect(applyFrostedBackgroundBlur(root, 12)).toBe(12)
    expect(Object.fromEntries(properties)).toEqual({
      '--frosted-background-blur': '12px',
      '--frosted-background-bleed': '18px'
    })
    expect(attributes.get('data-frosted-background-blur')).toBe('12')
  })
})
