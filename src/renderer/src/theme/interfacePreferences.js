import { APPEARANCE_MESSAGE_KEYS } from './appearanceMessages'

export const INTERFACE_ZOOM = Object.freeze({
  DEFAULT: 100,
  MIN: 80,
  MAX: 150,
  STEP: 10
})

export const INTERFACE_FONT_IDS = Object.freeze({
  THEME: 'theme',
  SYSTEM: 'system',
  SANS: 'sans',
  SERIF: 'serif',
  KAI: 'kai'
})

export const INTERFACE_WEIGHT_IDS = Object.freeze({
  LIGHT: 'light',
  STANDARD: 'standard',
  HEAVY: 'heavy'
})

export const INTERFACE_FONT_OPTIONS = Object.freeze([
  Object.freeze({ id: INTERFACE_FONT_IDS.THEME, labelKey: APPEARANCE_MESSAGE_KEYS.fontThemeLabel }),
  Object.freeze({ id: INTERFACE_FONT_IDS.SYSTEM, labelKey: APPEARANCE_MESSAGE_KEYS.fontSystemLabel }),
  Object.freeze({ id: INTERFACE_FONT_IDS.SANS, labelKey: APPEARANCE_MESSAGE_KEYS.fontSansLabel }),
  Object.freeze({ id: INTERFACE_FONT_IDS.SERIF, labelKey: APPEARANCE_MESSAGE_KEYS.fontSerifLabel }),
  Object.freeze({ id: INTERFACE_FONT_IDS.KAI, labelKey: APPEARANCE_MESSAGE_KEYS.fontKaiLabel })
])

export const INTERFACE_WEIGHT_OPTIONS = Object.freeze([
  Object.freeze({ id: INTERFACE_WEIGHT_IDS.LIGHT, labelKey: APPEARANCE_MESSAGE_KEYS.weightLightLabel }),
  Object.freeze({ id: INTERFACE_WEIGHT_IDS.STANDARD, labelKey: APPEARANCE_MESSAGE_KEYS.weightStandardLabel }),
  Object.freeze({ id: INTERFACE_WEIGHT_IDS.HEAVY, labelKey: APPEARANCE_MESSAGE_KEYS.weightHeavyLabel })
])

const FONT_IDS = new Set(INTERFACE_FONT_OPTIONS.map(option => option.id))
const WEIGHT_IDS = new Set(INTERFACE_WEIGHT_OPTIONS.map(option => option.id))

export function normalizeInterfaceZoom(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return INTERFACE_ZOOM.DEFAULT
  const clamped = Math.min(INTERFACE_ZOOM.MAX, Math.max(INTERFACE_ZOOM.MIN, numeric))
  return Math.round(clamped / INTERFACE_ZOOM.STEP) * INTERFACE_ZOOM.STEP
}

export function normalizeInterfaceFontId(value) {
  return FONT_IDS.has(value) ? value : INTERFACE_FONT_IDS.THEME
}

export function normalizeInterfaceWeightId(value) {
  return WEIGHT_IDS.has(value) ? value : INTERFACE_WEIGHT_IDS.STANDARD
}

export function resolveInterfacePreferences(config = {}) {
  return {
    interfaceZoom: normalizeInterfaceZoom(config.interfaceZoom),
    interfaceFont: normalizeInterfaceFontId(config.interfaceFont),
    interfaceWeight: normalizeInterfaceWeightId(config.interfaceWeight)
  }
}

export function applyInterfacePreferencesToRoot(root, config = {}) {
  const resolved = resolveInterfacePreferences(config)
  root.setAttribute('data-interface-font', resolved.interfaceFont)
  root.setAttribute('data-interface-weight', resolved.interfaceWeight)
  return resolved
}

export function getZoomDeltaFromKeyboardEvent(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return 0

  if (event.code === 'Equal' || event.code === 'NumpadAdd' || event.key === '+') {
    return INTERFACE_ZOOM.STEP
  }

  if (event.code === 'Minus' || event.code === 'NumpadSubtract' || event.key === '-') {
    return -INTERFACE_ZOOM.STEP
  }

  return 0
}

export function getZoomDeltaFromWheelEvent(event) {
  if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return 0
  return event.deltaY < 0 ? INTERFACE_ZOOM.STEP : -INTERFACE_ZOOM.STEP
}
