import defaultFrostedBackground from '../assets/themes/frosted-glass-background.png'
import {
  DEFAULT_FROSTED_PALETTE,
  deriveAdaptiveFrostedPalette
} from './frostedGlassPalette'

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

export async function applyFrostedGlassBackground(root, customDataUrl = null) {
  const applicationId = ++latestApplication
  let objectUrl = null

  if (customDataUrl) {
    try {
      objectUrl = await createObjectUrlFromDataUrl(customDataUrl)
    } catch {
      objectUrl = null
    }
    if (applicationId !== latestApplication) {
      releaseObjectUrl(objectUrl)
      return DEFAULT_FROSTED_PALETTE
    }
  }

  const previousObjectUrl = activeObjectUrl
  activeObjectUrl = objectUrl
  root.style.setProperty('--frosted-background-image', toCssImageUrl(objectUrl || defaultFrostedBackground))
  root.setAttribute('data-frosted-background', objectUrl ? 'custom' : 'default')
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

export { defaultFrostedBackground }
