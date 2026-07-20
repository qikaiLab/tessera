import { APPEARANCE_MESSAGE_KEYS } from './appearanceMessages'

export const INTERFACE_STYLE_IDS = Object.freeze({
  DEFAULT: 'default',
  LINEN_STUDY: 'linen-study',
  JADE_ARCHIVE: 'jade-archive',
  FROSTED_GLASS: 'frosted-glass'
})

export const THEME_ACCENT_IDS = Object.freeze({
  VIOLET: 'violet',
  OCEAN: 'ocean',
  FOREST: 'forest',
  EMBER: 'ember',
  CYAN: 'cyan',
  YELLOW: 'yellow',
  PINK: 'pink',
  GRAPHITE: 'graphite'
})

export const INTERFACE_STYLE_REGISTRY = Object.freeze([
  Object.freeze({
    id: INTERFACE_STYLE_IDS.DEFAULT,
    labelKey: APPEARANCE_MESSAGE_KEYS.defaultStyleLabel,
    descriptionKey: APPEARANCE_MESSAGE_KEYS.defaultStyleDescription,
    available: true,
    fixedTheme: null
  }),
  Object.freeze({
    id: INTERFACE_STYLE_IDS.LINEN_STUDY,
    labelKey: APPEARANCE_MESSAGE_KEYS.linenStyleLabel,
    descriptionKey: APPEARANCE_MESSAGE_KEYS.linenStyleDescription,
    available: true,
    fixedTheme: 'light'
  }),
  Object.freeze({
    id: INTERFACE_STYLE_IDS.JADE_ARCHIVE,
    labelKey: APPEARANCE_MESSAGE_KEYS.jadeStyleLabel,
    descriptionKey: APPEARANCE_MESSAGE_KEYS.jadeStyleDescription,
    available: true,
    fixedTheme: 'dark'
  }),
  Object.freeze({
    id: INTERFACE_STYLE_IDS.FROSTED_GLASS,
    labelKey: APPEARANCE_MESSAGE_KEYS.frostedGlassStyleLabel,
    descriptionKey: APPEARANCE_MESSAGE_KEYS.frostedGlassStyleDescription,
    available: true,
    fixedTheme: null,
    capabilities: Object.freeze(['background-image'])
  })
])

export const SELECTABLE_INTERFACE_STYLES = Object.freeze(
  INTERFACE_STYLE_REGISTRY.filter(style => style.available)
)

export const THEME_ACCENT_OPTIONS = Object.freeze([
  Object.freeze({ id: THEME_ACCENT_IDS.VIOLET, labelKey: APPEARANCE_MESSAGE_KEYS.violetAccentLabel, preview: '#7c6aff' }),
  Object.freeze({ id: THEME_ACCENT_IDS.OCEAN, labelKey: APPEARANCE_MESSAGE_KEYS.oceanAccentLabel, preview: '#5b8cff' }),
  Object.freeze({ id: THEME_ACCENT_IDS.FOREST, labelKey: APPEARANCE_MESSAGE_KEYS.forestAccentLabel, preview: '#45b58a' }),
  Object.freeze({ id: THEME_ACCENT_IDS.EMBER, labelKey: APPEARANCE_MESSAGE_KEYS.emberAccentLabel, preview: '#d88d58' }),
  Object.freeze({ id: THEME_ACCENT_IDS.CYAN, labelKey: APPEARANCE_MESSAGE_KEYS.cyanAccentLabel, preview: '#2bb7b3' }),
  Object.freeze({ id: THEME_ACCENT_IDS.YELLOW, labelKey: APPEARANCE_MESSAGE_KEYS.yellowAccentLabel, preview: '#d9b24c' }),
  Object.freeze({ id: THEME_ACCENT_IDS.PINK, labelKey: APPEARANCE_MESSAGE_KEYS.pinkAccentLabel, preview: '#e184a8' }),
  Object.freeze({ id: THEME_ACCENT_IDS.GRAPHITE, labelKey: APPEARANCE_MESSAGE_KEYS.graphiteAccentLabel, preview: '#66707c' })
])

const STYLE_BY_ID = new Map(INTERFACE_STYLE_REGISTRY.map(style => [style.id, style]))
const SELECTABLE_STYLE_IDS = new Set(SELECTABLE_INTERFACE_STYLES.map(style => style.id))
const ACCENT_IDS = new Set(THEME_ACCENT_OPTIONS.map(accent => accent.id))

export function normalizeInterfaceStyleId(value) {
  return SELECTABLE_STYLE_IDS.has(value) ? value : INTERFACE_STYLE_IDS.DEFAULT
}

export function normalizeTheme(value) {
  return value === 'light' ? 'light' : 'dark'
}

export function normalizeThemeAccentId(value) {
  return ACCENT_IDS.has(value) ? value : THEME_ACCENT_IDS.VIOLET
}

export function getInterfaceStyle(styleId) {
  return STYLE_BY_ID.get(styleId) ?? STYLE_BY_ID.get(INTERFACE_STYLE_IDS.DEFAULT)
}

export function resolveEffectiveTheme(styleId, defaultTheme) {
  const style = getInterfaceStyle(normalizeInterfaceStyleId(styleId))
  return style.fixedTheme ?? normalizeTheme(defaultTheme)
}

export function isThemeToggleAvailable(styleId) {
  return getInterfaceStyle(normalizeInterfaceStyleId(styleId)).fixedTheme === null
}

export function resolveAppearanceConfig(config = {}) {
  const interfaceStyle = normalizeInterfaceStyleId(config.interfaceStyle)
  const theme = normalizeTheme(config.theme)
  const themeAccent = normalizeThemeAccentId(config.themeAccent)

  return {
    interfaceStyle,
    theme,
    themeAccent,
    effectiveTheme: resolveEffectiveTheme(interfaceStyle, theme)
  }
}

export function applyAppearanceToRoot(root, config = {}) {
  const resolved = resolveAppearanceConfig(config)
  root.setAttribute('data-interface-style', resolved.interfaceStyle)
  root.setAttribute('data-theme', resolved.effectiveTheme)
  root.setAttribute('data-theme-accent', resolved.themeAccent)
  return resolved
}
