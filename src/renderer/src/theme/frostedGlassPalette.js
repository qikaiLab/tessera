export const DEFAULT_FROSTED_PALETTE = Object.freeze({
  hue: 212,
  saturation: 64
})

const HUE_BIN_COUNT = 24

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
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

export function deriveAdaptiveFrostedPalette(pixelData) {
  if (!pixelData || pixelData.length < 4) return DEFAULT_FROSTED_PALETTE

  const bins = Array.from({ length: HUE_BIN_COUNT }, () => ({ weight: 0, x: 0, y: 0, saturation: 0 }))
  for (let index = 0; index <= pixelData.length - 4; index += 4) {
    const alpha = pixelData[index + 3] / 255
    if (alpha < 0.5) continue

    const color = rgbToHsl(pixelData[index], pixelData[index + 1], pixelData[index + 2])
    if (color.saturation < 0.08 || color.lightness < 0.06 || color.lightness > 0.96) continue

    const centerBias = 1 - Math.min(0.7, Math.abs(color.lightness - 0.52))
    const weight = alpha * centerBias * (color.chroma * 1.4 + color.saturation * 0.6)
    const binIndex = Math.floor(color.hue / (360 / HUE_BIN_COUNT)) % HUE_BIN_COUNT
    const radians = color.hue * Math.PI / 180
    bins[binIndex].weight += weight
    bins[binIndex].x += Math.cos(radians) * weight
    bins[binIndex].y += Math.sin(radians) * weight
    bins[binIndex].saturation += color.saturation * weight
  }

  let strongestIndex = -1
  let strongestWeight = 0
  for (let index = 0; index < bins.length; index += 1) {
    const previous = bins[(index - 1 + bins.length) % bins.length].weight
    const combinedWeight = previous + bins[index].weight + bins[(index + 1) % bins.length].weight
    if (combinedWeight > strongestWeight) {
      strongestWeight = combinedWeight
      strongestIndex = index
    }
  }
  if (strongestIndex < 0 || strongestWeight < 0.01) return DEFAULT_FROSTED_PALETTE

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

  const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  return {
    hue: Math.round(hue),
    saturation: Math.round(clamp(saturation / weight * 100, 48, 78))
  }
}
