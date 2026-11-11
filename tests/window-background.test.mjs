import { describe, expect, it } from 'vitest'
import {
  DARK_WINDOW_BACKGROUND,
  LIGHT_WINDOW_BACKGROUND,
  resolveWindowBackground
} from '../src/main/windowBackground.js'
import { isFreshInstallConfig, resolveAppearanceConfig, FRESH_INSTALL_APPEARANCE } from '../src/renderer/src/theme/appearanceRegistry.js'

describe('the window colour before the page paints', () => {
  it('is light on a first launch and dark for a saved dark theme', () => {
    expect(resolveWindowBackground({})).toBe(LIGHT_WINDOW_BACKGROUND)
    expect(resolveWindowBackground({ theme: 'dark' })).toBe(DARK_WINDOW_BACKGROUND)
    expect(resolveWindowBackground({ theme: 'light', interfaceStyle: 'default' })).toBe(LIGHT_WINDOW_BACKGROUND)
    expect(resolveWindowBackground({ onboardingDone: true })).toBe(DARK_WINDOW_BACKGROUND)
  })

  it('follows the fixed brightness of linen and jade', () => {
    expect(resolveWindowBackground({ interfaceStyle: 'linen-study', theme: 'dark' })).toBe(LIGHT_WINDOW_BACKGROUND)
    expect(resolveWindowBackground({ interfaceStyle: 'jade-archive', theme: 'light' })).toBe(DARK_WINDOW_BACKGROUND)
  })

  it('agrees with the renderer about what a first launch is and what it looks like', () => {
    const samples = [{}, { dataDir: 'D:/x' }, { onboardingDone: true }, { theme: 'dark' }, { themeAccent: 'ocean' }, { interfaceStyle: 'default' }]
    for (const config of samples) {
      const effective = isFreshInstallConfig(config) ? FRESH_INSTALL_APPEARANCE : config
      const expected = resolveAppearanceConfig(effective).effectiveTheme === 'light'
        ? LIGHT_WINDOW_BACKGROUND
        : DARK_WINDOW_BACKGROUND
      expect(resolveWindowBackground(config)).toBe(expected)
    }
  })
})
