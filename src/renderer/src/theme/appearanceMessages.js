export const APPEARANCE_MESSAGE_KEYS = Object.freeze({
  sectionTitle: 'appearance.section.title',
  sectionDescription: 'appearance.section.description',
  themeColorTitle: 'appearance.themeColor.title',
  themeColorDescription: 'appearance.themeColor.description',
  defaultStyleLabel: 'appearance.styles.default.label',
  defaultStyleDescription: 'appearance.styles.default.description',
  linenStyleLabel: 'appearance.styles.linenStudy.label',
  linenStyleDescription: 'appearance.styles.linenStudy.description',
  jadeStyleLabel: 'appearance.styles.jadeArchive.label',
  jadeStyleDescription: 'appearance.styles.jadeArchive.description',
  frostedGlassStyleLabel: 'appearance.styles.frostedGlass.label',
  frostedGlassStyleDescription: 'appearance.styles.frostedGlass.description',
  violetAccentLabel: 'appearance.accents.violet',
  oceanAccentLabel: 'appearance.accents.ocean',
  forestAccentLabel: 'appearance.accents.forest',
  emberAccentLabel: 'appearance.accents.ember',
  switchToLight: 'appearance.theme.switchToLight',
  switchToDark: 'appearance.theme.switchToDark',
  fixedTheme: 'appearance.theme.fixed'
})

const ZH_CN_APPEARANCE_MESSAGES = Object.freeze({
  [APPEARANCE_MESSAGE_KEYS.sectionTitle]: '界面风格',
  [APPEARANCE_MESSAGE_KEYS.sectionDescription]: '选择一套全局视觉风格。切换只影响界面外观，不会改变任何记录与功能。',
  [APPEARANCE_MESSAGE_KEYS.themeColorTitle]: '主题色',
  [APPEARANCE_MESSAGE_KEYS.themeColorDescription]: '主题色仅用于默认风格。',
  [APPEARANCE_MESSAGE_KEYS.defaultStyleLabel]: '默认风格',
  [APPEARANCE_MESSAGE_KEYS.defaultStyleDescription]: '保留现有明暗外观，可自定义主题色。',
  [APPEARANCE_MESSAGE_KEYS.linenStyleLabel]: '亚麻书房',
  [APPEARANCE_MESSAGE_KEYS.linenStyleDescription]: '柔和纸张与亚麻质感，适合安静阅读和书写。',
  [APPEARANCE_MESSAGE_KEYS.jadeStyleLabel]: '墨玉档案',
  [APPEARANCE_MESSAGE_KEYS.jadeStyleDescription]: '深墨玉与低调金色点缀，沉稳而克制。',
  [APPEARANCE_MESSAGE_KEYS.frostedGlassStyleLabel]: '雾化玻璃',
  [APPEARANCE_MESSAGE_KEYS.frostedGlassStyleDescription]: '玻璃效果与自定义背景图，后续版本开放。',
  [APPEARANCE_MESSAGE_KEYS.violetAccentLabel]: '暮光紫',
  [APPEARANCE_MESSAGE_KEYS.oceanAccentLabel]: '静海蓝',
  [APPEARANCE_MESSAGE_KEYS.forestAccentLabel]: '松林绿',
  [APPEARANCE_MESSAGE_KEYS.emberAccentLabel]: '暖陶棕',
  [APPEARANCE_MESSAGE_KEYS.switchToLight]: '切换亮色模式',
  [APPEARANCE_MESSAGE_KEYS.switchToDark]: '切换暗色模式',
  [APPEARANCE_MESSAGE_KEYS.fixedTheme]: '当前界面风格使用固定明暗配色'
})

export function appearanceText(key) {
  return ZH_CN_APPEARANCE_MESSAGES[key] ?? key
}
