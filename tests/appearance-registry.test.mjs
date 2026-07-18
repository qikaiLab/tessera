import { describe, expect, it } from 'vitest'
import {
  INTERFACE_STYLE_IDS,
  INTERFACE_STYLE_REGISTRY,
  SELECTABLE_INTERFACE_STYLES,
  THEME_ACCENT_IDS,
  applyAppearanceToRoot,
  normalizeInterfaceStyleId,
  normalizeThemeAccentId,
  resolveAppearanceConfig,
  resolveEffectiveTheme
} from '../src/renderer/src/theme/appearanceRegistry.js'

describe('appearance registry', () => {
  it('exposes only completed styles while retaining the frosted-glass extension point', () => {
    expect(SELECTABLE_INTERFACE_STYLES.map(style => style.id)).toEqual([
      INTERFACE_STYLE_IDS.DEFAULT,
      INTERFACE_STYLE_IDS.LINEN_STUDY,
      INTERFACE_STYLE_IDS.JADE_ARCHIVE
    ])

    expect(INTERFACE_STYLE_REGISTRY.find(style => style.id === INTERFACE_STYLE_IDS.FROSTED_GLASS)).toMatchObject({
      available: false,
      capabilities: ['background-image']
    })
  })

  it('falls back safely for unknown or unavailable persisted values', () => {
    expect(normalizeInterfaceStyleId('blue-mist')).toBe(INTERFACE_STYLE_IDS.DEFAULT)
    expect(normalizeInterfaceStyleId(INTERFACE_STYLE_IDS.FROSTED_GLASS)).toBe(INTERFACE_STYLE_IDS.DEFAULT)
    expect(normalizeThemeAccentId('unknown')).toBe(THEME_ACCENT_IDS.VIOLET)
  })

  it('keeps the default theme preference but fixes linen and jade brightness', () => {
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.DEFAULT, 'light')).toBe('light')
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.LINEN_STUDY, 'dark')).toBe('light')
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.JADE_ARCHIVE, 'light')).toBe('dark')
  })

  it('normalizes legacy config and applies decoupled data attributes', () => {
    const attributes = new Map()
    const root = {
      setAttribute(name, value) {
        attributes.set(name, value)
      }
    }

    const resolved = applyAppearanceToRoot(root, {
      interfaceStyle: INTERFACE_STYLE_IDS.JADE_ARCHIVE,
      theme: 'light',
      themeAccent: THEME_ACCENT_IDS.OCEAN
    })

    expect(resolved).toEqual(resolveAppearanceConfig({
      interfaceStyle: INTERFACE_STYLE_IDS.JADE_ARCHIVE,
      theme: 'light',
      themeAccent: THEME_ACCENT_IDS.OCEAN
    }))
    expect(Object.fromEntries(attributes)).toEqual({
      'data-interface-style': INTERFACE_STYLE_IDS.JADE_ARCHIVE,
      'data-theme': 'dark',
      'data-theme-accent': THEME_ACCENT_IDS.OCEAN
    })
  })
})
