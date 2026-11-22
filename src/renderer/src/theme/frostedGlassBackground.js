import {
  DEFAULT_FROSTED_PALETTE,
  deriveAdaptiveFrostedPalette
} from './frostedGlassPalette'
import { FROSTED_WALLPAPER_IDS } from './frostedGlassPreferences'
import { defaultFrostedBackground, getFrostedWallpaperSource } from './frostedGlassWallpapers'

let latestApplication = 0
let activeObjectUrl = null

// Chromium drops custom property values over 2 MB, so a base64 data URL stored in
// --frosted-background-image silently fails for photos larger than ~1.5 MB. A blob
// URL stays tiny no matter how large the image is.
async function createObjectUrlFromDataUrl(dataUrl) {
  const response = await fetch(dataUrl)
  return URL.createObjectURL(await response.blob())
}

function releaseObjectUrl(url) {
  if (url) URL.revokeObjectURL(url)
}

function setPaletteProperties(root, palette) {
  root.style.setProperty('--frosted-accent-h', String(palette.hue))
  root.style.setProperty('--frosted-accent-s', `${palette.saturation}%`)
  root.style.setProperty('--frosted-tint-s', `${palette.tintSaturation}%`)
  root.style.setProperty('--frosted-tint-k', String(Math.round(palette.tintSaturation / DEFAULT_FROSTED_PALETTE.tintSaturation * 1000) / 1000))
  root.style.setProperty('--frosted-dark-scrim', String(palette.darkScrim))
  root.style.setProperty('--frosted-light-scrim', String(palette.lightScrim))
}

function toCssImageUrl(source) {
  return `url("${source.replaceAll('"', '%22')}")`
}

async function extractPaletteFromImage(source) {
  const image = new Image()
  image.decoding = 'async'
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = source
  })

  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return DEFAULT_FROSTED_PALETTE
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return deriveAdaptiveFrostedPalette(context.getImageData(0, 0, canvas.width, canvas.height).data)
}

// The colours of a bundled wallpaper never change, so each is measured once.
const presetPalettes = new Map()

async function paletteOfPreset(id, source) {
  if (id === FROSTED_WALLPAPER_IDS.DEFAULT) return DEFAULT_FROSTED_PALETTE
  if (presetPalettes.has(id)) return presetPalettes.get(id)
  try {
    const palette = await extractPaletteFromImage(source)
    presetPalettes.set(id, palette)
    return palette
  } catch {
    return DEFAULT_FROSTED_PALETTE
  }
}

async function applyCustomBackground(root, customDataUrl, applicationId) {
  let objectUrl = null
  try {
    objectUrl = await createObjectUrlFromDataUrl(customDataUrl)
  } catch {
    objectUrl = null
  }
  if (applicationId !== latestApplication) {
    releaseObjectUrl(objectUrl)
    return DEFAULT_FROSTED_PALETTE
  }

  const previousObjectUrl = activeObjectUrl
  activeObjectUrl = objectUrl
  root.style.setProperty('--frosted-background-image', toCssImageUrl(objectUrl || defaultFrostedBackground))
  root.setAttribute('data-frosted-background', objectUrl ? FROSTED_WALLPAPER_IDS.CUSTOM : FROSTED_WALLPAPER_IDS.DEFAULT)
  setPaletteProperties(root, DEFAULT_FROSTED_PALETTE)
  releaseObjectUrl(previousObjectUrl)

  if (!objectUrl) return DEFAULT_FROSTED_PALETTE

  try {
    const palette = await extractPaletteFromImage(objectUrl)
    if (applicationId === latestApplication) setPaletteProperties(root, palette)
    return palette
  } catch {
    return DEFAULT_FROSTED_PALETTE
  }
}

/**
 * Shows the chosen wallpaper behind the glass and sets the glass colours to match it.
 * `wallpaperId` is one of FROSTED_WALLPAPER_IDS; the imported picture (`custom`) needs its data
 * URL, and without one the default wallpaper is shown instead.
 */
export async function applyFrostedGlassBackground(root, { wallpaperId = FROSTED_WALLPAPER_IDS.DEFAULT, customDataUrl = null } = {}) {
  const applicationId = ++latestApplication

  if (wallpaperId === FROSTED_WALLPAPER_IDS.CUSTOM && customDataUrl) {
    return applyCustomBackground(root, customDataUrl, applicationId)
  }

  const id = wallpaperId === FROSTED_WALLPAPER_IDS.CUSTOM ? FROSTED_WALLPAPER_IDS.DEFAULT : wallpaperId
  const source = getFrostedWallpaperSource(id)
  // The colours are ready before the picture is shown, so the glass never flashes the old tint.
  const palette = await paletteOfPreset(id, source)
  if (applicationId !== latestApplication) return palette

  const previousObjectUrl = activeObjectUrl
  activeObjectUrl = null
  root.style.setProperty('--frosted-background-image', toCssImageUrl(source))
  root.setAttribute('data-frosted-background', id)
  setPaletteProperties(root, palette)
  releaseObjectUrl(previousObjectUrl)
  return palette
}

export { defaultFrostedBackground }
