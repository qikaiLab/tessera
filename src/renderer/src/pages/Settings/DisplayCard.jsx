import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import SelectMenu from '../../components/SelectMenu'
import { APPEARANCE_MESSAGE_KEYS, appearanceText } from '../../theme/appearanceMessages'
import {
  INTERFACE_FONT_OPTIONS,
  INTERFACE_WEIGHT_OPTIONS,
  INTERFACE_ZOOM
} from '../../theme/interfacePreferences'
import './DisplayCard.css'

// The zoom slider follows the pointer while it is dragged, but the interface is only rescaled
// when the drag ends: rescaling under the pointer would move the slider away from it.
function useInterfaceZoomDraft(interfaceZoom, updateInterfaceZoom) {
  const [interfaceZoomDraft, setInterfaceZoomDraft] = useState(interfaceZoom)
  const interfaceZoomPointerActiveRef = useRef(false)

  useEffect(() => {
    if (!interfaceZoomPointerActiveRef.current) setInterfaceZoomDraft(interfaceZoom)
  }, [interfaceZoom])

  const handleInterfaceZoomChange = (event) => {
    const nextZoom = Number(event.currentTarget.value)
    setInterfaceZoomDraft(nextZoom)
    if (!interfaceZoomPointerActiveRef.current) updateInterfaceZoom(nextZoom)
  }

  const commitInterfaceZoomDrag = (value) => {
    if (!interfaceZoomPointerActiveRef.current) return
    interfaceZoomPointerActiveRef.current = false
    const nextZoom = Number(value)
    setInterfaceZoomDraft(nextZoom)
    updateInterfaceZoom(nextZoom)
  }

  const cancelInterfaceZoomDrag = () => {
    interfaceZoomPointerActiveRef.current = false
    setInterfaceZoomDraft(interfaceZoom)
  }

  return {
    interfaceZoomDraft,
    interfaceZoomPointerActiveRef,
    handleInterfaceZoomChange,
    commitInterfaceZoomDrag,
    cancelInterfaceZoomDrag
  }
}

// Zoom, font and weight of the whole interface.
export default function DisplayCard({ hidden }) {
  const {
    interfaceZoom, updateInterfaceZoom,
    interfaceFont, updateInterfaceFont,
    interfaceWeight, updateInterfaceWeight
  } = useApp()
  const {
    interfaceZoomDraft,
    interfaceZoomPointerActiveRef,
    handleInterfaceZoomChange,
    commitInterfaceZoomDrag,
    cancelInterfaceZoomDrag
  } = useInterfaceZoomDraft(interfaceZoom, updateInterfaceZoom)

  return (
    <div className="settings-card interface-display-card" hidden={hidden}>
      <div className="settings-card-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.displaySectionTitle)}</div>
      <div className="settings-card-desc">{appearanceText(APPEARANCE_MESSAGE_KEYS.displaySectionDescription)}</div>

      <div className="interface-preference-panel">
        <div className="interface-preference-row interface-zoom-row">
          <div className="interface-preference-copy">
            <span className="interface-preference-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.zoomTitle)}</span>
            <span className="interface-preference-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.zoomDescription)}</span>
          </div>
          <div className="interface-zoom-control">
            <button
              type="button"
              className="btn btn-secondary btn-sm interface-zoom-button"
              onClick={() => updateInterfaceZoom(interfaceZoom - INTERFACE_ZOOM.STEP)}
              disabled={interfaceZoom <= INTERFACE_ZOOM.MIN}
              aria-label="缩小界面"
            >
              −
            </button>
            <input
              className="interface-zoom-slider"
              type="range"
              min={INTERFACE_ZOOM.MIN}
              max={INTERFACE_ZOOM.MAX}
              step={INTERFACE_ZOOM.STEP}
              value={interfaceZoomDraft}
              onPointerDown={() => { interfaceZoomPointerActiveRef.current = true }}
              onChange={handleInterfaceZoomChange}
              onPointerUp={event => commitInterfaceZoomDrag(event.currentTarget.value)}
              onPointerCancel={cancelInterfaceZoomDrag}
              onBlur={event => commitInterfaceZoomDrag(event.currentTarget.value)}
              aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.zoomTitle)}
              aria-valuetext={`${interfaceZoomDraft}%`}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm interface-zoom-button"
              onClick={() => updateInterfaceZoom(interfaceZoom + INTERFACE_ZOOM.STEP)}
              disabled={interfaceZoom >= INTERFACE_ZOOM.MAX}
              aria-label="放大界面"
            >
              +
            </button>
            <output className="interface-zoom-value" aria-live="polite">{interfaceZoomDraft}%</output>
          </div>
        </div>

        <div className="interface-preference-row">
          <div className="interface-preference-copy">
            <span className="interface-preference-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.fontTitle)}</span>
            <span className="interface-preference-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.fontDescription)}</span>
          </div>
          <div className="interface-preference-select">
            <SelectMenu
              ariaLabel="软件字体"
              options={INTERFACE_FONT_OPTIONS.map(option => ({ value: option.id, label: appearanceText(option.labelKey) }))}
              value={interfaceFont}
              onChange={updateInterfaceFont}
            />
          </div>
        </div>

        <div className="interface-preference-row">
          <div className="interface-preference-copy">
            <span className="interface-preference-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.weightTitle)}</span>
            <span className="interface-preference-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.weightDescription)}</span>
          </div>
          <div className="interface-weight-options" role="radiogroup" aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.weightTitle)}>
            {INTERFACE_WEIGHT_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                className={`interface-weight-option ${interfaceWeight === option.id ? 'selected' : ''}`}
                role="radio"
                aria-checked={interfaceWeight === option.id}
                onClick={() => updateInterfaceWeight(option.id)}
              >
                {appearanceText(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
