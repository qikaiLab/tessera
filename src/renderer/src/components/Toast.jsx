import React from 'react'
import { useApp } from '../context/AppContext'

export default function Toast() {
  const { toasts } = useApp()

  return (
    // A live region: screen readers announce what is added, and an error (a failed save, a refused
    // import) interrupts with role="alert". The glyph is decoration.
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type} ${t.leaving ? 'is-leaving' : ''}`}
          role={t.type === 'error' ? 'alert' : undefined}
        >
          <span aria-hidden="true">
            {t.type === 'success' && '✓'}
            {t.type === 'error' && '✕'}
            {t.type === 'info' && '•'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
