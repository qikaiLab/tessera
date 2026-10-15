import { useApp } from '../../context/AppContext'
import { clampEditorFontSize } from '../../utils/editorFontSize'

// The bar above a fullscreen editor: character count, line width and font size.
export default function FullscreenHeader({ maxWidth, charCount, fontSize, onFontSizeChange }) {
  const { fullscreenWidthMode, updateFullscreenWidthMode } = useApp()
  const standard = fullscreenWidthMode === 'standard'

  return (
    <div className="tiptap-fullscreen-header" style={{ maxWidth, '--fs-column-max': maxWidth }}>
      <span className="tiptap-char-count">{charCount} 字</span>
      <div className="tiptap-fullscreen-header-actions">
        <button
          className="btn btn-ghost btn-xs tiptap-width-toggle"
          onClick={() => updateFullscreenWidthMode(standard ? 'wide' : 'standard')}
          title={standard ? '切换为宽幅宽度' : '切换为标准行宽'}
        >
          {standard ? '↔ 宽屏' : '→← 标准'}
        </button>
        <span className="tiptap-font-controls">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => onFontSizeChange?.(clampEditorFontSize(fontSize - 1))}
            title="缩小字体"
          >
            A−
          </button>
          <span className="tiptap-font-label">{fontSize}</span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => onFontSizeChange?.(clampEditorFontSize(fontSize + 1))}
            title="放大字体"
          >
            A+
          </button>
        </span>
      </div>
    </div>
  )
}
