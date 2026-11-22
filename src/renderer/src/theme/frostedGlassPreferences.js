export const FROSTED_BACKGROUND_BLUR = Object.freeze({
  DEFAULT: 8,
  MIN: 0,
  MAX: 24,
  STEP: 2
})

export function normalizeFrostedBackgroundBlur(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return FROSTED_BACKGROUND_BLUR.DEFAULT
  const clamped = Math.min(
    FROSTED_BACKGROUND_BLUR.MAX,
    Math.max(FROSTED_BACKGROUND_BLUR.MIN, numeric)
  )
  return Math.round(clamped / FROSTED_BACKGROUND_BLUR.STEP) * FROSTED_BACKGROUND_BLUR.STEP
}

export function applyFrostedBackgroundBlur(root, value) {
  const blur = normalizeFrostedBackgroundBlur(value)
  root.style.setProperty('--frosted-background-blur', `${blur}px`)
  root.style.setProperty('--frosted-background-bleed', `${blur * 1.5}px`)
  root.setAttribute('data-frosted-background-blur', String(blur))
  return blur
}

export const FROSTED_WALLPAPER_IDS = Object.freeze({
  DEFAULT: 'default',
  DUSK: 'dusk',
  FOREST: 'forest',
  OCEAN: 'ocean',
  CUSTOM: 'custom'
})

const FROSTED_WALLPAPER_ID_SET = new Set(Object.values(FROSTED_WALLPAPER_IDS))

// Which wallpaper is showing, from the saved choice and whether an imported picture exists.
// Before the choice was saved (and for anyone updating from a version that only had a custom
// picture) an imported picture counts as the choice, so nobody's background changes on update.
// A saved choice of the imported picture without the file falls back to the default.
export function resolveFrostedWallpaperId(saved, hasCustomBackground) {
  if (saved === FROSTED_WALLPAPER_IDS.CUSTOM) {
    return hasCustomBackground ? FROSTED_WALLPAPER_IDS.CUSTOM : FROSTED_WALLPAPER_IDS.DEFAULT
  }
  if (typeof saved === 'string' && FROSTED_WALLPAPER_ID_SET.has(saved)) return saved
  return hasCustomBackground ? FROSTED_WALLPAPER_IDS.CUSTOM : FROSTED_WALLPAPER_IDS.DEFAULT
}
