import { describe, expect, it } from 'vitest'
import { PREFERRED_WINDOW, SMALLEST_USABLE_WINDOW, fitWindowToWorkArea, parseWorkAreaOverride } from '../src/main/windowBounds.js'

describe('fitWindowToWorkArea', () => {
  it('keeps the preferred size on a screen that has room for it', () => {
    expect(fitWindowToWorkArea({ width: 2560, height: 1400 })).toEqual(PREFERRED_WINDOW)
    expect(fitWindowToWorkArea({ width: 1280, height: 800 })).toEqual(PREFERRED_WINDOW)
  })

  it('shrinks the window to a 1920x1080 display at 150% scaling (1280x680 usable)', () => {
    expect(fitWindowToWorkArea({ width: 1280, height: 680 })).toEqual({ width: 1280, height: 680, minWidth: 900, minHeight: 600 })
  })

  it('shrinks the smallest size too, so a 1366x768 laptop at 125% (about 1093x574) is not pushed off the screen', () => {
    expect(fitWindowToWorkArea({ width: 1093, height: 574 })).toEqual({ width: 1093, height: 574, minWidth: 900, minHeight: 574 })
  })

  it('never goes below the smallest usable window, even on a tiny screen', () => {
    const tiny = fitWindowToWorkArea({ width: 300, height: 200 })
    expect(tiny.minWidth).toBe(SMALLEST_USABLE_WINDOW.width)
    expect(tiny.minHeight).toBe(SMALLEST_USABLE_WINDOW.height)
    expect(tiny.width).toBe(SMALLEST_USABLE_WINDOW.width)
    expect(tiny.height).toBe(SMALLEST_USABLE_WINDOW.height)
  })

  it('never makes the window larger than the preferred size', () => {
    const fitted = fitWindowToWorkArea({ width: 5000, height: 5000 })
    expect(fitted.width).toBeLessThanOrEqual(PREFERRED_WINDOW.width)
    expect(fitted.minWidth).toBeLessThanOrEqual(fitted.width)
    expect(fitted.minHeight).toBeLessThanOrEqual(fitted.height)
  })

  it('keeps the minimum no larger than the window for every screen size', () => {
    for (let width = 200; width <= 3000; width += 97) {
      for (let height = 200; height <= 2000; height += 89) {
        const fitted = fitWindowToWorkArea({ width, height })
        expect(fitted.minWidth).toBeLessThanOrEqual(fitted.width)
        expect(fitted.minHeight).toBeLessThanOrEqual(fitted.height)
        expect(fitted.width).toBeLessThanOrEqual(Math.max(width, SMALLEST_USABLE_WINDOW.width))
        expect(fitted.height).toBeLessThanOrEqual(Math.max(height, SMALLEST_USABLE_WINDOW.height))
      }
    }
  })

  it('falls back to the preferred size when the work area is unknown or nonsense', () => {
    for (const bad of [null, undefined, {}, { width: 0, height: 0 }, { width: NaN, height: -5 }, { width: 'wide', height: '600' }]) {
      expect(fitWindowToWorkArea(bad)).toEqual(PREFERRED_WINDOW)
    }
  })

  it('handles fractional work areas from a scaled display', () => {
    const fitted = fitWindowToWorkArea({ width: 1093.6, height: 574.4 })
    expect(Number.isInteger(fitted.width) && Number.isInteger(fitted.height)).toBe(true)
  })
})

describe('parseWorkAreaOverride', () => {
  it('reads WIDTHxHEIGHT from the environment', () => {
    expect(parseWorkAreaOverride({ TESSERA_E2E_WORK_AREA: '1093x574' })).toEqual({ width: 1093, height: 574 })
  })

  it('ignores anything else', () => {
    for (const value of [undefined, '', '1093', '1093x', 'axb', '10x10', '1093x574x1', '-1093x574']) {
      expect(parseWorkAreaOverride({ TESSERA_E2E_WORK_AREA: value })).toBeNull()
    }
  })
})
