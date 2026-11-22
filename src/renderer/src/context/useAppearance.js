import { useCallback, useRef, useState } from 'react'
import {
  FRESH_INSTALL_APPEARANCE,
  INTERFACE_STYLE_IDS,
  THEME_ACCENT_IDS,
  applyAppearanceToRoot,
  isFreshInstallConfig,
  isThemeToggleAvailable,
  normalizeInterfaceStyleId,
  normalizeTheme,
  normalizeThemeAccentId
} from '../theme/appearanceRegistry'
import { applyFrostedGlassBackground } from '../theme/frostedGlassBackground'
import {
  FROSTED_BACKGROUND_BLUR,
  FROSTED_WALLPAPER_IDS,
  applyFrostedBackgroundBlur,
  normalizeFrostedBackgroundBlur,
  resolveFrostedWallpaperId
} from '../theme/frostedGlassPreferences'
import {
  INTERFACE_FONT_IDS,
  INTERFACE_WEIGHT_IDS,
  INTERFACE_ZOOM,
  applyInterfacePreferencesToRoot,
  normalizeInterfaceFontId,
  normalizeInterfaceWeightId,
  normalizeInterfaceZoom
} from '../theme/interfacePreferences'

/**
 * Everything about how the interface looks: light / dark, interface style, accent colour, the
 * frosted-glass wallpaper and blur, zoom, font and weight. Each change is applied to the page
 * at once and saved to the app config; `loadAppearance(config)` applies the saved config on
 * startup.
 */
export function useAppearance() {
  const [theme, setTheme] = useState('dark')
  const [interfaceStyle, setInterfaceStyle] = useState(INTERFACE_STYLE_IDS.DEFAULT)
  const [themeAccent, setThemeAccent] = useState(THEME_ACCENT_IDS.VIOLET)
  // The imported picture as a data URL (null when none), and which wallpaper is showing.
  const [frostedBackgroundUrl, setFrostedBackgroundUrl] = useState(null)
  const [frostedWallpaper, setFrostedWallpaper] = useState(FROSTED_WALLPAPER_IDS.DEFAULT)
  const [frostedBackgroundBlur, setFrostedBackgroundBlur] = useState(FROSTED_BACKGROUND_BLUR.DEFAULT)
  const [interfaceZoom, setInterfaceZoom] = useState(INTERFACE_ZOOM.DEFAULT)
  const [interfaceFont, setInterfaceFont] = useState(INTERFACE_FONT_IDS.THEME)
  const [interfaceWeight, setInterfaceWeight] = useState(INTERFACE_WEIGHT_IDS.STANDARD)
  const interfaceZoomRef = useRef(INTERFACE_ZOOM.DEFAULT)

  const root = () => document.documentElement

  const toggleTheme = useCallback(() => {
    if (!isThemeToggleAvailable(interfaceStyle)) return
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyAppearanceToRoot(root(), { interfaceStyle, theme: next, themeAccent })
    window.api.config.set('theme', next)
  }, [interfaceStyle, theme, themeAccent])

  const updateInterfaceStyle = useCallback((value) => {
    const next = normalizeInterfaceStyleId(value)
    setInterfaceStyle(next)
    applyAppearanceToRoot(root(), { interfaceStyle: next, theme, themeAccent })
    window.api.config.set('interfaceStyle', next)
  }, [theme, themeAccent])

  const updateThemeAccent = useCallback((value) => {
    const next = normalizeThemeAccentId(value)
    setThemeAccent(next)
    applyAppearanceToRoot(root(), { interfaceStyle, theme, themeAccent: next })
    window.api.config.set('themeAccent', next)
  }, [interfaceStyle, theme])

  const showFrostedWallpaper = useCallback(async (wallpaperId, customDataUrl) => {
    setFrostedWallpaper(wallpaperId)
    window.api.config.set('frostedWallpaper', wallpaperId)
    await applyFrostedGlassBackground(root(), { wallpaperId, customDataUrl })
  }, [])

  const selectFrostedWallpaper = useCallback(async (value) => {
    // Showing the imported picture needs one to exist; picking a bundled wallpaper keeps it for later.
    if (value === FROSTED_WALLPAPER_IDS.CUSTOM && !frostedBackgroundUrl) return
    const next = resolveFrostedWallpaperId(value, Boolean(frostedBackgroundUrl))
    await showFrostedWallpaper(next, frostedBackgroundUrl)
  }, [frostedBackgroundUrl, showFrostedWallpaper])

  const importFrostedBackground = useCallback(async () => {
    const result = await window.api.appearanceBackground.import()
    if (result.ok && !result.canceled && result.background?.dataUrl) {
      setFrostedBackgroundUrl(result.background.dataUrl)
      await showFrostedWallpaper(FROSTED_WALLPAPER_IDS.CUSTOM, result.background.dataUrl)
    }
    return result
  }, [showFrostedWallpaper])

  // Deletes the imported picture. If it was showing, the default wallpaper takes its place.
  const clearFrostedBackground = useCallback(async () => {
    const result = await window.api.appearanceBackground.clear()
    if (result.ok) {
      setFrostedBackgroundUrl(null)
      if (frostedWallpaper === FROSTED_WALLPAPER_IDS.CUSTOM) {
        await showFrostedWallpaper(FROSTED_WALLPAPER_IDS.DEFAULT, null)
      }
    }
    return result
  }, [frostedWallpaper, showFrostedWallpaper])

  const updateFrostedBackgroundBlur = useCallback((value) => {
    const next = applyFrostedBackgroundBlur(root(), value)
    setFrostedBackgroundBlur(next)
    window.api.config.set('frostedBackgroundBlur', next)
  }, [])

  const updateInterfaceZoom = useCallback((value) => {
    const next = normalizeInterfaceZoom(value)
    interfaceZoomRef.current = next
    setInterfaceZoom(next)
    window.api.zoom.setFactor(next / 100)
    window.api.config.set('interfaceZoom', next)
  }, [])

  const adjustInterfaceZoom = useCallback((delta) => {
    updateInterfaceZoom(interfaceZoomRef.current + delta)
  }, [updateInterfaceZoom])

  const updateInterfaceFont = useCallback((value) => {
    const next = normalizeInterfaceFontId(value)
    setInterfaceFont(next)
    applyInterfacePreferencesToRoot(root(), { interfaceFont: next, interfaceWeight })
    window.api.config.set('interfaceFont', next)
  }, [interfaceWeight])

  const updateInterfaceWeight = useCallback((value) => {
    const next = normalizeInterfaceWeightId(value)
    setInterfaceWeight(next)
    applyInterfacePreferencesToRoot(root(), { interfaceFont, interfaceWeight: next })
    window.api.config.set('interfaceWeight', next)
  }, [interfaceFont])

  // Applies the saved config (from `window.api.config.get()`) and the saved frosted background.
  const loadAppearance = useCallback(async (loadedConfig) => {
    // A first launch starts with the fresh-install look, which is saved right away so that a later
    // change to one setting never sends the others back to the old defaults.
    const fresh = isFreshInstallConfig(loadedConfig)
    const config = fresh ? { ...loadedConfig, ...FRESH_INSTALL_APPEARANCE } : loadedConfig
    if (fresh) {
      try {
        for (const [key, value] of Object.entries(FRESH_INSTALL_APPEARANCE)) {
          await window.api.config.set(key, value)
        }
      } catch (error) {
        console.error('Failed to save the first-launch appearance:', error)
      }
    }
    const savedTheme = normalizeTheme(config.theme)
    const savedStyle = normalizeInterfaceStyleId(config.interfaceStyle)
    const savedAccent = normalizeThemeAccentId(config.themeAccent)
    const savedZoom = normalizeInterfaceZoom(config.interfaceZoom)
    const savedFont = normalizeInterfaceFontId(config.interfaceFont)
    const savedWeight = normalizeInterfaceWeightId(config.interfaceWeight)
    const savedBlur = normalizeFrostedBackgroundBlur(config.frostedBackgroundBlur)
    setTheme(savedTheme)
    setInterfaceStyle(savedStyle)
    setThemeAccent(savedAccent)
    interfaceZoomRef.current = savedZoom
    setInterfaceZoom(savedZoom)
    setInterfaceFont(savedFont)
    setInterfaceWeight(savedWeight)
    setFrostedBackgroundBlur(savedBlur)
    applyAppearanceToRoot(root(), { interfaceStyle: savedStyle, theme: savedTheme, themeAccent: savedAccent })
    applyInterfacePreferencesToRoot(root(), { interfaceFont: savedFont, interfaceWeight: savedWeight })
    applyFrostedBackgroundBlur(root(), savedBlur)

    const backgroundResult = await window.api.appearanceBackground.get()
    const savedBackground = backgroundResult.ok ? backgroundResult.background?.dataUrl ?? null : null
    const savedWallpaper = resolveFrostedWallpaperId(config.frostedWallpaper, Boolean(savedBackground))
    setFrostedBackgroundUrl(savedBackground)
    setFrostedWallpaper(savedWallpaper)
    await applyFrostedGlassBackground(root(), { wallpaperId: savedWallpaper, customDataUrl: savedBackground })
    window.api.zoom.setFactor(savedZoom / 100)
  }, [])

  return {
    theme, toggleTheme,
    interfaceStyle, updateInterfaceStyle,
    themeAccent, updateThemeAccent,
    frostedBackgroundUrl, frostedWallpaper, selectFrostedWallpaper,
    importFrostedBackground, clearFrostedBackground,
    frostedBackgroundBlur, updateFrostedBackgroundBlur,
    interfaceZoom, updateInterfaceZoom, adjustInterfaceZoom,
    interfaceFont, updateInterfaceFont,
    interfaceWeight, updateInterfaceWeight,
    loadAppearance
  }
}
