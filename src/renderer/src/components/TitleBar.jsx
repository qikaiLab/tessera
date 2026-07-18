import React, { useState, useEffect } from 'react'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    const off = window.api.window.onStateChange((state) => {
      setIsMaximized(state === 'maximized')
    })
    return off
  }, [])

  return (
    <div className="titlebar">
      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          type="button"
          onClick={() => window.api.window.minimize()}
          title="最小化"
          aria-label="最小化窗口"
        >
          ─
        </button>
        <button
          className="titlebar-btn"
          type="button"
          onClick={() => window.api.window.maximize()}
          title={isMaximized ? '还原' : '最大化'}
          aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
        >
          {isMaximized ? '⊟' : '⊡'}
        </button>
        <button
          className="titlebar-btn close"
          type="button"
          onClick={() => window.api.window.close()}
          title="关闭"
          aria-label="关闭软件"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
