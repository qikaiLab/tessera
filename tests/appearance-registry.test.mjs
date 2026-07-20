import { describe, expect, it } from 'vitest'
import {
  INTERFACE_STYLE_IDS,
  INTERFACE_STYLE_REGISTRY,
  SELECTABLE_INTERFACE_STYLES,
  THEME_ACCENT_IDS,
  THEME_ACCENT_OPTIONS,
  applyAppearanceToRoot,
  isThemeToggleAvailable,
  normalizeInterfaceStyleId,
  normalizeThemeAccentId,
  resolveAppearanceConfig,
  resolveEffectiveTheme
} from '../src/renderer/src/theme/appearanceRegistry.js'

describe('appearance registry', () => {
  it('offers eight centralized accents for the default style', () => {
    expect(THEME_ACCENT_OPTIONS).toHaveLength(8)
    expect(THEME_ACCENT_OPTIONS.map(option => option.id)).toEqual([
      THEME_ACCENT_IDS.VIOLET,
      THEME_ACCENT_IDS.OCEAN,
      THEME_ACCENT_IDS.FOREST,
      THEME_ACCENT_IDS.EMBER,
      THEME_ACCENT_IDS.CYAN,
      THEME_ACCENT_IDS.YELLOW,
      THEME_ACCENT_IDS.PINK,
      THEME_ACCENT_IDS.GRAPHITE
    ])
  })

  it('exposes all completed styles including Frosted Glass', () => {
    expect(SELECTABLE_INTERFACE_STYLES.map(style => style.id)).toEqual([
      INTERFACE_STYLE_IDS.DEFAULT,
      INTERFACE_STYLE_IDS.LINEN_STUDY,
      INTERFACE_STYLE_IDS.JADE_ARCHIVE,
      INTERFACE_STYLE_IDS.FROSTED_GLASS
    ])

    expect(INTERFACE_STYLE_REGISTRY.find(style => style.id === INTERFACE_STYLE_IDS.FROSTED_GLASS)).toMatchObject({
      available: true,
      capabilities: ['background-image']
    })
  })

  it('falls back safely for unknown persisted values', () => {
    expect(normalizeInterfaceStyleId('blue-mist')).toBe(INTERFACE_STYLE_IDS.DEFAULT)
    expect(normalizeInterfaceStyleId(INTERFACE_STYLE_IDS.FROSTED_GLASS)).toBe(INTERFACE_STYLE_IDS.FROSTED_GLASS)
    expect(normalizeThemeAccentId('unknown')).toBe(THEME_ACCENT_IDS.VIOLET)
  })

  it('keeps the default theme preference but fixes linen and jade brightness', () => {
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.DEFAULT, 'light')).toBe('light')
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.LINEN_STUDY, 'dark')).toBe('light')
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.JADE_ARCHIVE, 'light')).toBe('dark')
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.FROSTED_GLASS, 'light')).toBe('light')
    expect(resolveEffectiveTheme(INTERFACE_STYLE_IDS.FROSTED_GLASS, 'dark')).toBe('dark')
    expect(isThemeToggleAvailable(INTERFACE_STYLE_IDS.DEFAULT)).toBe(true)
    expect(isThemeToggleAvailable(INTERFACE_STYLE_IDS.FROSTED_GLASS)).toBe(true)
    expect(isThemeToggleAvailable(INTERFACE_STYLE_IDS.LINEN_STUDY)).toBe(false)
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
