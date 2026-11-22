import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  INTERFACE_STYLE_IDS,
  SELECTABLE_INTERFACE_STYLES,
  THEME_ACCENT_OPTIONS
} from '../../theme/appearanceRegistry'
import { APPEARANCE_MESSAGE_KEYS, appearanceText } from '../../theme/appearanceMessages'
import { FROSTED_BACKGROUND_BLUR, FROSTED_WALLPAPER_IDS } from '../../theme/frostedGlassPreferences'
import { FROSTED_WALLPAPER_PRESETS } from '../../theme/frostedGlassWallpapers'
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

// The wallpaper behind the glass and its blur, for Frosted Glass. Picking a wallpaper shows it
// at once; the page itself is the preview.
function FrostedBackgroundPanel() {
  const {
    frostedBackgroundUrl, frostedWallpaper, selectFrostedWallpaper,
    importFrostedBackground, clearFrostedBackground,
    frostedBackgroundBlur, updateFrostedBackgroundBlur, showToast
  } = useApp()
  const [busy, setBusy] = useState(false)
  const customSelected = frostedWallpaper === FROSTED_WALLPAPER_IDS.CUSTOM

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

  const handleRemove = async () => {
    setBusy(true)
    try {
      const result = await clearFrostedBackground()
      if (result.ok) showToast('已移除我的图片', 'success')
      else showToast(result.error || '移除图片失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const customLabel = appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundCustomName)

  return (
    <div className="appearance-wallpaper-panel">
      <div className="appearance-wallpaper-row">
        <div className="appearance-accent-copy">
          <span className="appearance-accent-title">
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundTitle)}
          </span>
          <span className="appearance-accent-description">
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundDescription)}
          </span>
          {frostedBackgroundUrl ? (
            <span className="appearance-wallpaper-custom-actions">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={handleImport}>
                {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundReplace)}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={handleRemove}>
                {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundRemove)}
              </button>
            </span>
          ) : null}
        </div>
        <div className="appearance-wallpaper-options">
          <div
            className="appearance-wallpaper-choices"
            role="radiogroup"
            aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundTitle)}
          >
            {FROSTED_WALLPAPER_PRESETS.map(preset => {
              const label = appearanceText(preset.labelKey)
              const selected = preset.id === frostedWallpaper
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`appearance-wallpaper-option ${selected ? 'selected' : ''}`}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectFrostedWallpaper(preset.id)}
                >
                  <img className="appearance-wallpaper-thumb" src={preset.source} alt="" draggable="false" />
                  <span>{label}</span>
                </button>
              )
            })}
            {frostedBackgroundUrl ? (
              <button
                type="button"
                className={`appearance-wallpaper-option appearance-wallpaper-custom ${customSelected ? 'selected' : ''}`}
                role="radio"
                aria-checked={customSelected}
                onClick={() => selectFrostedWallpaper(FROSTED_WALLPAPER_IDS.CUSTOM)}
              >
                <img className="appearance-wallpaper-thumb" src={frostedBackgroundUrl} alt="" draggable="false" />
                <span>{customLabel}</span>
              </button>
            ) : null}
          </div>
          {frostedBackgroundUrl ? null : (
            <button
              type="button"
              className="appearance-wallpaper-option appearance-wallpaper-import"
              disabled={busy}
              onClick={handleImport}
            >
              <span className="appearance-wallpaper-thumb appearance-wallpaper-plus" aria-hidden="true">+</span>
              <span>{appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundImport)}</span>
              <small>{appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundImportHint)}</small>
            </button>
          )}
        </div>
      </div>
      <div className="appearance-wallpaper-row">
        <div className="appearance-accent-copy">
          <span className="appearance-accent-title">
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurTitle)}
          </span>
          <span className="appearance-accent-description">
            {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurDescription)}
          </span>
        </div>
        <div className="appearance-wallpaper-blur">
          <input
            className="appearance-wallpaper-blur-slider"
            type="range"
            min={FROSTED_BACKGROUND_BLUR.MIN}
            max={FROSTED_BACKGROUND_BLUR.MAX}
            step={FROSTED_BACKGROUND_BLUR.STEP}
            value={frostedBackgroundBlur}
            onChange={event => updateFrostedBackgroundBlur(event.currentTarget.value)}
            aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurTitle)}
            aria-valuetext={frostedBackgroundBlur === 0 ? '不虚化' : `${frostedBackgroundBlur} 像素`}
          />
          <output className="appearance-wallpaper-blur-value" aria-live="polite">
            {frostedBackgroundBlur === 0 ? '无' : `${frostedBackgroundBlur}px`}
          </output>
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
