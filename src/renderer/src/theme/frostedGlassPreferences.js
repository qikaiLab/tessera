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
  root.style.setProperty('--frosted-preview-blur', `${Math.round(blur / 2)}px`)
  root.setAttribute('data-frosted-background-blur', String(blur))
  return blur
}
