import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import TiptapEditor from '../../components/TiptapEditor'
import { collapseDurationMs } from '../../utils/collapseMotion'
import { EDITOR_FONT_SIZE_MAX, EDITOR_FONT_SIZE_MIN, useEditorFontSize } from '../../utils/editorFontSize'
import { FULLSCREEN_EDITOR_SHORTCUT_LABEL } from '../../utils/editorShortcuts'
import { getSectionPreview } from '../../utils/sectionPreview'
import { useFullscreenPresence } from '../../utils/useFullscreenPresence'
import FavoriteButton from './FavoriteButton'
import SectionTypeBadge from './SectionTypeBadge'

// The stored value is a serialized Tiptap document; older data may be plain text.
function parseDocument(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }]
    }
  }
}

// While the editor is fullscreen it leaves the card's flow: remember how tall the card's body
// was and hold that space, so the cards below stay put and nothing jumps when fullscreen ends.
function useHeldBodyHeight(bodyRef, isFullScreen) {
  const heightRef = useRef(0)
  useEffect(() => {
    const body = bodyRef.current
    if (!body || isFullScreen) return undefined
    heightRef.current = body.offsetHeight
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => { heightRef.current = body.offsetHeight })
    observer.observe(body)
    return () => observer.disconnect()
  }, [bodyRef, isFullScreen])
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || !isFullScreen) return undefined
    body.style.minHeight = `${heightRef.current}px`
    return () => { body.style.minHeight = '' }
  }, [bodyRef, isFullScreen])
}

// A text section: a rich-text editor card that can fold, show a word count, change its font
// size and go fullscreen.
export default function TextCard({
  section,
  value,
  onChange,
  onContextMenu,
  animationDelay,
  dateTransitionDir,
  isFullScreen: fullScreenRequested,
  favorite,
  onToggleFavorite,
  closable,
  onClose,
  collapsed,
  onToggleCollapsed,
  onSave,
  onToggleFullScreen
}) {
  const cardRef = useRef(null)
  const bodyRef = useRef(null)
  // Fullscreen lingers briefly after it is switched off so its exit animation can play.
  const { show: isFullScreen, leaving: fullScreenLeaving } = useFullscreenPresence(fullScreenRequested)
  useHeldBodyHeight(bodyRef, isFullScreen)
  const [charCount, setCharCount] = useState(0)
  const [fontSize, changeFontSize] = useEditorFontSize()
  const parsedValue = useMemo(() => parseDocument(value), [value])

  // Folding takes longer the more text has to travel. The editor keeps its natural height in
  // scrollHeight even while folded, so the same duration applies in both directions and a
  // click in mid-flight simply reverses the transition.
  const handleToggleCollapsed = () => {
    const shell = cardRef.current?.querySelector('.text-editor-body > .tiptap-shell')
    cardRef.current?.style.setProperty('--collapse-ms', `${collapseDurationMs(shell?.scrollHeight)}ms`)
    onToggleCollapsed()
  }

  return (
    <div
      ref={cardRef}
      className={`section-card date-card-${dateTransitionDir} ${isFullScreen ? 'fullscreen-active-parent' : ''} ${collapsed && !isFullScreen ? 'is-collapsed' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onContextMenu={onContextMenu}
    >
      {/* The header keeps its normal shape under the fullscreen layer (only made inert), so the
          card does not change size or content when fullscreen starts or ends. */}
      <div className="section-card-header" inert={isFullScreen ? '' : undefined}>
        <div className="section-card-header-left">
          <button
            type="button"
            className="section-collapse-btn"
            onClick={handleToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `展开${section.name}` : `收起${section.name}`}
            title={collapsed ? '展开' : '收起'}
          >
            <span className="section-collapse-chevron" aria-hidden="true">▾</span>
          </button>
          <span className="section-card-title">{section.name}</span>
          <SectionTypeBadge section={section} closable={closable} onClose={onClose} />
          {collapsed && !isFullScreen && (
            <button type="button" className="section-collapsed-preview" onClick={handleToggleCollapsed}>
              {getSectionPreview(value) || '（空）'}
            </button>
          )}
        </div>
        <div className="section-card-header-right">
          <FavoriteButton favorite={favorite} onToggle={onToggleFavorite} name={section.name} />
          <span className="char-count-badge">{charCount} 字</span>
          <div className="card-font-controls">
            <button
              className="btn btn-ghost btn-xs font-ctrl-btn"
              onClick={() => changeFontSize(Math.max(EDITOR_FONT_SIZE_MIN, fontSize - 1))}
              title="缩小字体"
            >
              A−
            </button>
            <span className="font-ctrl-label">{fontSize}</span>
            <button
              className="btn btn-ghost btn-xs font-ctrl-btn"
              onClick={() => changeFontSize(Math.min(EDITOR_FONT_SIZE_MAX, fontSize + 1))}
              title="放大字体"
            >
              A+
            </button>
          </div>
          {onToggleFullScreen && (
            <button
              className="btn btn-ghost btn-xs btn-icon fullscreen-btn"
              onClick={onToggleFullScreen}
              title={`全屏写作 (${FULLSCREEN_EDITOR_SHORTCUT_LABEL})`}
              aria-label={`进入全屏写作，快捷键 ${FULLSCREEN_EDITOR_SHORTCUT_LABEL}`}
            >
              ⛶
            </button>
          )}
        </div>
      </div>
      <div ref={bodyRef} className="section-card-body text-editor-body">
        <TiptapEditor
          value={parsedValue}
          onChange={onChange}
          placeholder={`记录你的${section.name}...`}
          isFullScreen={isFullScreen}
          fullScreenLeaving={fullScreenLeaving}
          onToggleFullScreen={onToggleFullScreen}
          onSave={onSave}
          fontSize={fontSize}
          onFontSizeChange={changeFontSize}
          onCharCountChange={setCharCount}
        />
      </div>
    </div>
  )
}
