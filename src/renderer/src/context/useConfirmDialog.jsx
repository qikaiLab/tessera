import { useCallback, useState } from 'react'
import Presence from '../components/Presence'

/**
 * `confirm({ title, message, confirmText, cancelText, danger })` resolves to true or false once
 * the user answers. `dialog` is the element to render (once, anywhere in the tree).
 */
export function useConfirmDialog() {
  const [config, setConfig] = useState(null)

  const confirm = useCallback(({ message, title = '提示', confirmText = '确定', cancelText = '取消', danger = false }) => {
    return new Promise((resolve) => {
      setConfig({ message, title, confirmText, cancelText, danger, resolve })
    })
  }, [])

  const answer = (value) => {
    config.resolve(value)
    setConfig(null)
  }

  const dialog = (
    <Presence>{config && (
      <div className="modal-overlay" onClick={() => answer(false)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <span className="modal-title">{config.title}</span>
            <button className="btn btn-ghost btn-icon" onClick={() => answer(false)}>✕</button>
          </div>
          <div style={{ marginBottom: 20, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            {config.message.split('\n').map((line, idx) => (
              <p key={idx} style={{ marginTop: idx > 0 ? 8 : 0 }}>{line}</p>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => answer(false)}>
              {config.cancelText}
            </button>
            <button
              className="btn btn-primary"
              style={config.danger ? { background: 'var(--error)' } : {}}
              onClick={() => answer(true)}
            >
              {config.confirmText}
            </button>
          </div>
        </div>
      </div>
    )}</Presence>
  )

  return { confirm, dialog }
}
