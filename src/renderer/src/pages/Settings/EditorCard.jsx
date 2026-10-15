import { useApp } from '../../context/AppContext'
import './EditorCard.css'

// Typesetting of the editors, as text fields: label, placeholder, hint, and the setting behind it.
function typesettingFields(settings) {
  return [
    {
      id: 'standard-width',
      label: '标准行宽 (标准模式)',
      placeholder: '700px',
      tip: '全屏模式下的常规宽度 (例如: 700px)',
      value: settings.fullscreenStandardWidth,
      onChange: settings.updateFullscreenStandardWidth
    },
    {
      id: 'wide-width',
      label: '宽屏行宽 (宽屏模式)',
      placeholder: '1000px',
      tip: '全屏模式下的宽幅宽度 (例如: 1000px 或 90%)',
      value: settings.fullscreenWideWidth,
      onChange: settings.updateFullscreenWideWidth
    },
    {
      id: 'line-height',
      label: '行间距 (行高比例)',
      placeholder: '1.8',
      tip: '正文行高比例 (无单位数值，如: 1.8)',
      value: settings.editorLineHeight,
      onChange: settings.updateEditorLineHeight
    },
    {
      id: 'letter-spacing',
      label: '字间距 (字元额外间距)',
      placeholder: '0px',
      tip: '字与字之间的间距 (支持 em/px，如: 0.02em 或 0.5px，默认 0px)',
      value: settings.editorLetterSpacing,
      onChange: settings.updateEditorLetterSpacing
    }
  ]
}

export default function EditorCard({ hidden }) {
  const settings = useApp()
  return (
    <div className="settings-card animate-fade-in" hidden={hidden}>
      <div className="settings-card-title">编辑器排版设置</div>
      <div className="settings-card-desc">自定义日记与文本编辑器在沉浸式全屏及常规模式下的排版显示效果。</div>

      <div className="settings-typesetting-grid">
        {typesettingFields(settings).map(field => (
          <div className="settings-field" key={field.id}>
            <label className="settings-field-label">{field.label}</label>
            <input
              className="input settings-field-input"
              type="text"
              placeholder={field.placeholder}
              value={field.value}
              onChange={e => field.onChange(e.target.value)}
            />
            <span className="settings-field-tip">{field.tip}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
