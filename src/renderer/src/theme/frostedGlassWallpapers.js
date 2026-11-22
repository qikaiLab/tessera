import defaultWallpaper from '../assets/themes/frosted-glass-background.webp'
import duskWallpaper from '../assets/themes/frosted-wallpaper-dusk.webp'
import forestWallpaper from '../assets/themes/frosted-wallpaper-forest.webp'
import oceanWallpaper from '../assets/themes/frosted-wallpaper-ocean.webp'
import { APPEARANCE_MESSAGE_KEYS } from './appearanceMessages'
import { FROSTED_WALLPAPER_IDS } from './frostedGlassPreferences'

// The wallpapers that ship with the app, in the order the settings page lists them. The
// imported picture is not here: it lives in app-owned storage, not in the bundle.
export const FROSTED_WALLPAPER_PRESETS = Object.freeze([
  Object.freeze({
    id: FROSTED_WALLPAPER_IDS.DEFAULT,
    labelKey: APPEARANCE_MESSAGE_KEYS.frostedWallpaperDefault,
    source: defaultWallpaper
  }),
  Object.freeze({
    id: FROSTED_WALLPAPER_IDS.DUSK,
    labelKey: APPEARANCE_MESSAGE_KEYS.frostedWallpaperDusk,
    source: duskWallpaper
  }),
  Object.freeze({
    id: FROSTED_WALLPAPER_IDS.FOREST,
    labelKey: APPEARANCE_MESSAGE_KEYS.frostedWallpaperForest,
    source: forestWallpaper
  }),
  Object.freeze({
    id: FROSTED_WALLPAPER_IDS.OCEAN,
    labelKey: APPEARANCE_MESSAGE_KEYS.frostedWallpaperOcean,
    source: oceanWallpaper
  })
])

export function getFrostedWallpaperSource(id) {
  return (FROSTED_WALLPAPER_PRESETS.find(preset => preset.id === id) ?? FROSTED_WALLPAPER_PRESETS[0]).source
}

export { defaultWallpaper as defaultFrostedBackground }
