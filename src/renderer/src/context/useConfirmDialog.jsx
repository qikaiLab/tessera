import { useCallback, useId, useRef, useState } from 'react'
import ModalFrame from '../components/ModalFrame'
import Presence from '../components/Presence'

/**
 * `confirm({ title, message, confirmText, cancelText, danger, dismissValue })` resolves once the
 * user answers: true for the confirm button, false for the cancel button. Closing the dialog any
 * other way (✕, Esc, a click outside) resolves to `dismissValue` (false unless given), so a caller
 * whose cancel button does something of its own can tell "go back" from that button.
 * `dialog` is the element to render (once, anywhere in the tree).
 *
 * Asking again while a question is still open dismisses the open one, so no caller waits forever.
 */
export function useConfirmDialog() {
  const [config, setConfig] = useState(null)
  const currentRef = useRef(null)
  const messageId = useId()

  const confirm = useCallback(({
    message, title = '提示', confirmText = '确定', cancelText = '取消', danger = false, dismissValue = false
  }) => {
    return new Promise((resolve) => {
      currentRef.current?.resolve(currentRef.current.dismissValue)
      const next = { message, title, confirmText, cancelText, danger, dismissValue, resolve }
      currentRef.current = next
      setConfig(next)
    })
  }, [])

  const answer = (value) => {
    const current = currentRef.current
    if (!current) return
    currentRef.current = null
    setConfig(null)
    current.resolve(value)
  }

  const dialog = (
    <Presence>{config && (
      <ModalFrame
        role="alertdialog"
        label={config.title}
        aria-describedby={messageId}
        onDismiss={() => answer(config.dismissValue)}
        style={{ maxWidth: 400 }}
      >
        <div className="modal-header">
          <span className="modal-title">{config.title}</span>
          <button className="btn btn-ghost btn-icon" aria-label="关闭" onClick={() => answer(config.dismissValue)}>✕</button>
        </div>
        <div id={messageId} style={{ marginBottom: 20, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          {config.message.split('\n').map((line, idx) => (
            <p key={idx} style={{ marginTop: idx > 0 ? 8 : 0 }}>{line}</p>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {/* A question about something that cannot be undone starts on the safe answer. */}
          <button className="btn btn-ghost" data-autofocus={config.danger ? '' : undefined} onClick={() => answer(false)}>
            {config.cancelText}
          </button>
          <button
            className="btn btn-primary"
            data-autofocus={config.danger ? undefined : ''}
            style={config.danger ? { background: 'var(--error)' } : {}}
            onClick={() => answer(true)}
          >
            {config.confirmText}
          </button>
        </div>
      </ModalFrame>
    )}</Presence>
  )

  return { confirm, dialog }
}
