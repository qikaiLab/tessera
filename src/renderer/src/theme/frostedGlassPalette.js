/*
 * Derives the Frosted Glass colour tokens from a background photo.
 *
 * What the photo can tell us, and how each part is used:
 *  - hue          where on the colour wheel the photo's real colour sits (accent + tint hue);
 *  - colourfulness how much colour it has at all. A rainy, black-and-white or night photo has
 *                 almost none, and tinting the glass strongly with a stray orange light would
 *                 look wrong, so the glass tint fades out smoothly instead of being forced
 *                 to a minimum;
 *  - brightness   very bright photos wash out light text on dark glass (and very dark ones
 *                 sink dark text on light glass), so a soft scrim is added where needed.
 */
export const DEFAULT_FROSTED_PALETTE = Object.freeze({
  hue: 212,
  saturation: 64,
  tintSaturation: 64,
  darkScrim: 0,
  lightScrim: 0
})

const HUE_BIN_COUNT = 24

// Below this much average chroma a photo is treated as neutral; at CHROMA_FULL it gets the
// full tint. Calibrated on grey/rainy/night photos (< 0.03), muted scenery (~0.08-0.12) and
// vivid or sunset photos (> 0.2).
const CHROMA_NEUTRAL = 0.035
const CHROMA_FULL = 0.2

const TINT_SATURATION = Object.freeze({ neutral: 5, vivid: 62 })
const ACCENT_SATURATION = Object.freeze({ neutral: 20, min: 46, max: 76 })

const SCRIM = Object.freeze({
  // Brightness (0-1) above which dark glass needs help / below which light glass does.
  brightAbove: 0.52,
  darkBelow: 0.4,
  gain: 0.75,
  maxDark: 0.34,
  maxLight: 0.3
})

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function lerp(from, to, amount) {
  return from + (to - from) * amount
}

function smoothstep(amount) {
  const t = clamp(amount, 0, 1)
  return t * t * (3 - 2 * t)
}

export function rgbToHsl(red, green, blue) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const maximum = Math.max(r, g, b)
  const minimum = Math.min(r, g, b)
  const chroma = maximum - minimum
  const lightness = (maximum + minimum) / 2

  if (chroma === 0) return { hue: 0, saturation: 0, lightness, chroma }

  let hue
  if (maximum === r) hue = ((g - b) / chroma) % 6
  else if (maximum === g) hue = (b - r) / chroma + 2
  else hue = (r - g) / chroma + 4

  hue = (hue * 60 + 360) % 360
  const saturation = chroma / (1 - Math.abs(2 * lightness - 1))
  return { hue, saturation, lightness, chroma }
}

/**
 * Measures a photo: its overall colourfulness (mean chroma of the mid-tones, where hue is
 * meaningful), mean brightness, and a weighted histogram of its hues.
 */
export function analyzePixels(pixelData) {
  const bins = Array.from({ length: HUE_BIN_COUNT }, () => ({ weight: 0, x: 0, y: 0, saturation: 0 }))
  let opaque = 0
  let brightnessSum = 0
  let chromaSum = 0
  let midSum = 0

  for (let index = 0; index <= pixelData.length - 4; index += 4) {
    const alpha = pixelData[index + 3] / 255
    if (alpha < 0.5) continue

    const red = pixelData[index]
    const green = pixelData[index + 1]
    const blue = pixelData[index + 2]
    const color = rgbToHsl(red, green, blue)

    opaque += alpha
    brightnessSum += alpha * (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

    // Near black and near white, hue is noise: weigh pixels by how mid-tone they are.
    const midness = 1 - Math.abs(2 * color.lightness - 1)
    chromaSum += alpha * midness * color.chroma
    midSum += alpha * midness

    if (color.chroma < 0.05 || color.lightness < 0.08 || color.lightness > 0.94) continue
    // Squared chroma: the few vivid pixels decide the hue, not a haze of faint tints.
    const weight = alpha * midness * color.chroma * color.chroma
    const binIndex = Math.floor(color.hue / (360 / HUE_BIN_COUNT)) % HUE_BIN_COUNT
    const radians = color.hue * Math.PI / 180
    bins[binIndex].weight += weight
    bins[binIndex].x += Math.cos(radians) * weight
    bins[binIndex].y += Math.sin(radians) * weight
    bins[binIndex].saturation += color.saturation * weight
  }

  return {
    brightness: opaque > 0 ? brightnessSum / opaque : 0.5,
    colorfulness: midSum > 0 ? chromaSum / midSum : 0,
    bins
  }
}

function dominantHue(bins) {
  let strongestIndex = -1
  let strongestWeight = 0
  for (let index = 0; index < bins.length; index += 1) {
    const previous = bins[(index - 1 + bins.length) % bins.length].weight
    const combined = previous + bins[index].weight + bins[(index + 1) % bins.length].weight
    if (combined > strongestWeight) {
      strongestWeight = combined
      strongestIndex = index
    }
  }
  if (strongestIndex < 0 || strongestWeight <= 0) return null

  let x = 0
  let y = 0
  let saturation = 0
  let weight = 0
  for (const offset of [-1, 0, 1]) {
    const bin = bins[(strongestIndex + offset + bins.length) % bins.length]
    x += bin.x
    y += bin.y
    saturation += bin.saturation
    weight += bin.weight
  }
  if (weight <= 0) return null
  return {
    hue: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
    saturation: saturation / weight
  }
}

export function deriveAdaptiveFrostedPalette(pixelData) {
  if (!pixelData || pixelData.length < 4) return DEFAULT_FROSTED_PALETTE

  const { brightness, colorfulness, bins } = analyzePixels(pixelData)
  const dominant = dominantHue(bins)

  // 0 for a neutral photo, 1 for a vivid one; everything in between blends smoothly, so two
  // similar photos never land on very different glass.
  const vividness = smoothstep((colorfulness - CHROMA_NEUTRAL) / (CHROMA_FULL - CHROMA_NEUTRAL))

  const hue = dominant ? Math.round(dominant.hue) : DEFAULT_FROSTED_PALETTE.hue
  const imageSaturation = dominant
    ? clamp(dominant.saturation * 100, ACCENT_SATURATION.min, ACCENT_SATURATION.max)
    : DEFAULT_FROSTED_PALETTE.saturation

  return {
    hue,
    saturation: Math.round(lerp(ACCENT_SATURATION.neutral, imageSaturation, vividness)),
    tintSaturation: Math.round(lerp(TINT_SATURATION.neutral, TINT_SATURATION.vivid, vividness)),
    darkScrim: roundScrim(clamp((brightness - SCRIM.brightAbove) * SCRIM.gain, 0, SCRIM.maxDark)),
    lightScrim: roundScrim(clamp((SCRIM.darkBelow - brightness) * SCRIM.gain, 0, SCRIM.maxLight))
  }
}

function roundScrim(value) {
  return Math.round(value * 100) / 100
}
