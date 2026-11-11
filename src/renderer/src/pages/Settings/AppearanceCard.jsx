import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  INTERFACE_STYLE_IDS,
  SELECTABLE_INTERFACE_STYLES,
  THEME_ACCENT_OPTIONS
} from '../../theme/appearanceRegistry'
import { APPEARANCE_MESSAGE_KEYS, appearanceText } from '../../theme/appearanceMessages'
import { defaultFrostedBackground } from '../../theme/frostedGlassBackground'
import { FROSTED_BACKGROUND_BLUR } from '../../theme/frostedGlassPreferences'
import defaultStylePreview from '../../assets/themes/default-preview.webp'
import linenStylePreview from '../../assets/themes/linen-preview.webp'
import jadeStylePreview from '../../assets/themes/jade-preview.webp'
import frostedStylePreview from '../../assets/themes/frosted-glass-preview.webp'
import './AppearanceCard.css'

const STYLE_PREVIEW_BY_ID = Object.freeze({
  [INTERFACE_STYLE_IDS.DEFAULT]: defaultStylePreview,
  [INTERFACE_STYLE_IDS.LINEN_STUDY]: linenStylePreview,
  [INTERFACE_STYLE_IDS.JADE_ARCHIVE]: jadeStylePreview,
  [INTERFACE_STYLE_IDS.FROSTED_GLASS]: frostedStylePreview
})

function StyleChooser() {
  const { interfaceStyle, updateInterfaceStyle } = useApp()
  return (
    <div className="appearance-style-grid" role="radiogroup" aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.sectionTitle)}>
      {SELECTABLE_INTERFACE_STYLES.map(style => {
        const selected = style.id === interfaceStyle
        return (
          <button
            key={style.id}
            type="button"
            className={`appearance-style-option ${selected ? 'selected' : ''}`}
            role="radio"
            aria-checked={selected}
            onClick={() => updateInterfaceStyle(style.id)}
          >
            <img
              className="appearance-style-preview"
              src={STYLE_PREVIEW_BY_ID[style.id]}
              alt=""
              draggable="false"
            />
            <span className="appearance-style-copy">
              <span className="appearance-style-name">{appearanceText(style.labelKey)}</span>
              <span className="appearance-style-description">{appearanceText(style.descriptionKey)}</span>
            </span>
            <span className="appearance-style-check" aria-hidden="true">✓</span>
          </button>
        )
      })}
    </div>
  )
}

// The accent colour of the default style.
function AccentPanel() {
  const { themeAccent, updateThemeAccent } = useApp()
  return (
    <div className="appearance-accent-panel">
      <div className="appearance-accent-copy">
        <span className="appearance-accent-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.themeColorTitle)}</span>
        <span className="appearance-accent-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.themeColorDescription)}</span>
      </div>
      <div className="appearance-accent-options" role="radiogroup" aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.themeColorTitle)}>
        {THEME_ACCENT_OPTIONS.map(accent => {
          const label = appearanceText(accent.labelKey)
          const selected = accent.id === themeAccent
          return (
            <button
              key={accent.id}
              type="button"
              className={`appearance-accent-option ${selected ? 'selected' : ''}`}
              style={{ '--accent-preview': accent.preview }}
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              onClick={() => updateThemeAccent(accent.id)}
            >
              <span className="appearance-accent-swatch" aria-hidden="true" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The background picture and its blur, for Frosted Glass.
function FrostedBackgroundPanel() {
  const {
    frostedBackgroundUrl, importFrostedBackground, clearFrostedBackground,
    frostedBackgroundBlur, updateFrostedBackgroundBlur, showToast
  } = useApp()
  const [busy, setBusy] = useState(false)

  const handleImport = async () => {
    setBusy(true)
    try {
      const result = await importFrostedBackground()
      if (result.ok && !result.canceled) showToast('雾化玻璃背景已更新', 'success')
      else if (!result.ok) showToast(result.error || '背景图片导入失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    setBusy(true)
    try {
      const result = await clearFrostedBackground()
      if (result.ok) showToast('已恢复系统默认背景', 'success')
      else showToast(result.error || '恢复默认背景失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="appearance-background-panel">
      <div className="appearance-background-preview">
        <img
          src={frostedBackgroundUrl || defaultFrostedBackground}
          alt=""
          draggable="false"
        />
        <span className="appearance-background-glass-sample" aria-hidden="true">
          Tessera
        </span>
      </div>
      <div className="appearance-background-content">
        <div className="appearance-background-copy">
          <span className="appearance-accent-title">
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundTitle)}
          </span>
          <span className="appearance-accent-description">
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundDescription)}
          </span>
          <span className="appearance-background-status">
            {appearanceText(frostedBackgroundUrl
              ? APPEARANCE_MESSAGE_KEYS.frostedBackgroundCustom
              : APPEARANCE_MESSAGE_KEYS.frostedBackgroundDefault)}
          </span>
        </div>
        <div className="appearance-background-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleImport}>
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundImport)}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy || !frostedBackgroundUrl} onClick={handleClear}>
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundRestore)}
          </button>
        </div>
        <div className="appearance-background-blur-control">
          <div className="appearance-background-blur-copy">
            <span className="appearance-accent-title">
              {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurTitle)}
            </span>
            <span className="appearance-accent-description">
              {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurDescription)}
            </span>
          </div>
          <div className="appearance-background-blur-slider-row">
            <input
              className="appearance-background-blur-slider"
              type="range"
              min={FROSTED_BACKGROUND_BLUR.MIN}
              max={FROSTED_BACKGROUND_BLUR.MAX}
              step={FROSTED_BACKGROUND_BLUR.STEP}
              value={frostedBackgroundBlur}
              onChange={event => updateFrostedBackgroundBlur(event.currentTarget.value)}
              aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurTitle)}
              aria-valuetext={frostedBackgroundBlur === 0 ? '不虚化' : `${frostedBackgroundBlur} 像素`}
            />
            <output className="appearance-background-blur-value" aria-live="polite">
              {frostedBackgroundBlur === 0 ? '无' : `${frostedBackgroundBlur}px`}
            </output>
          </div>
        </div>
      </div>
    </div>
  )
}

// Interface style, plus the controls that belong to the chosen style.
export default function AppearanceCard({ hidden }) {
  const { interfaceStyle } = useApp()
  return (
    <div className="settings-card appearance-settings-card" hidden={hidden}>
      <div className="settings-card-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.sectionTitle)}</div>
      <div className="settings-card-desc">{appearanceText(APPEARANCE_MESSAGE_KEYS.sectionDescription)}</div>
      <StyleChooser />
      {interfaceStyle === INTERFACE_STYLE_IDS.DEFAULT ? <AccentPanel /> : null}
      {interfaceStyle === INTERFACE_STYLE_IDS.FROSTED_GLASS ? <FrostedBackgroundPanel /> : null}
    </div>
  )
}
