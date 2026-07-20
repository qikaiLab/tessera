import { describe, expect, it } from 'vitest'
import {
  FROSTED_BACKGROUND_BLUR,
  applyFrostedBackgroundBlur,
  normalizeFrostedBackgroundBlur
} from '../src/renderer/src/theme/frostedGlassPreferences.js'

describe('Frosted Glass preferences', () => {
  it('normalizes background blur to safe persisted steps', () => {
    expect(normalizeFrostedBackgroundBlur(undefined)).toBe(FROSTED_BACKGROUND_BLUR.DEFAULT)
    expect(normalizeFrostedBackgroundBlur(-4)).toBe(FROSTED_BACKGROUND_BLUR.MIN)
    expect(normalizeFrostedBackgroundBlur(9)).toBe(10)
    expect(normalizeFrostedBackgroundBlur(80)).toBe(FROSTED_BACKGROUND_BLUR.MAX)
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
      '--frosted-background-bleed': '18px',
      '--frosted-preview-blur': '6px'
    })
    expect(attributes.get('data-frosted-background-blur')).toBe('12')
  })
})
