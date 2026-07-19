import { describe, expect, it } from 'vitest'
import {
  INTERFACE_FONT_IDS,
  INTERFACE_WEIGHT_IDS,
  INTERFACE_ZOOM,
  applyInterfacePreferencesToRoot,
  getZoomDeltaFromKeyboardEvent,
  getZoomDeltaFromWheelEvent,
  normalizeInterfaceFontId,
  normalizeInterfaceWeightId,
  normalizeInterfaceZoom
} from '../src/renderer/src/theme/interfacePreferences.js'

describe('interface preferences', () => {
  it('normalizes persisted zoom values to a safe range and stable steps', () => {
    expect(normalizeInterfaceZoom(undefined)).toBe(INTERFACE_ZOOM.DEFAULT)
    expect(normalizeInterfaceZoom(40)).toBe(INTERFACE_ZOOM.MIN)
    expect(normalizeInterfaceZoom(127)).toBe(130)
    expect(normalizeInterfaceZoom(240)).toBe(INTERFACE_ZOOM.MAX)
  })

  it('normalizes font and weight ids without depending on components', () => {
    expect(normalizeInterfaceFontId(INTERFACE_FONT_IDS.SERIF)).toBe(INTERFACE_FONT_IDS.SERIF)
    expect(normalizeInterfaceFontId('missing-font')).toBe(INTERFACE_FONT_IDS.THEME)
    expect(normalizeInterfaceWeightId(INTERFACE_WEIGHT_IDS.HEAVY)).toBe(INTERFACE_WEIGHT_IDS.HEAVY)
    expect(normalizeInterfaceWeightId('extra-bold')).toBe(INTERFACE_WEIGHT_IDS.STANDARD)
  })

  it('applies decoupled typography attributes to the root element', () => {
    const attributes = new Map()
    const root = { setAttribute: (name, value) => attributes.set(name, value) }

    applyInterfacePreferencesToRoot(root, {
      interfaceFont: INTERFACE_FONT_IDS.KAI,
      interfaceWeight: INTERFACE_WEIGHT_IDS.LIGHT
    })

    expect(Object.fromEntries(attributes)).toEqual({
      'data-interface-font': INTERFACE_FONT_IDS.KAI,
      'data-interface-weight': INTERFACE_WEIGHT_IDS.LIGHT
    })
  })

  it('recognizes keyboard and wheel zoom gestures without consuming unrelated input', () => {
    expect(getZoomDeltaFromKeyboardEvent({ ctrlKey: true, code: 'Equal' })).toBe(INTERFACE_ZOOM.STEP)
    expect(getZoomDeltaFromKeyboardEvent({ ctrlKey: true, code: 'NumpadSubtract' })).toBe(-INTERFACE_ZOOM.STEP)
    expect(getZoomDeltaFromKeyboardEvent({ ctrlKey: false, code: 'Equal' })).toBe(0)
    expect(getZoomDeltaFromKeyboardEvent({ ctrlKey: true, altKey: true, code: 'Equal' })).toBe(0)
    expect(getZoomDeltaFromWheelEvent({ ctrlKey: true, deltaY: -1 })).toBe(INTERFACE_ZOOM.STEP)
    expect(getZoomDeltaFromWheelEvent({ ctrlKey: true, deltaY: 1 })).toBe(-INTERFACE_ZOOM.STEP)
    expect(getZoomDeltaFromWheelEvent({ ctrlKey: false, deltaY: -1 })).toBe(0)
  })
})

