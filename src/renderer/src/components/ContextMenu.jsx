import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  activateContextMenuItem,
  subscribeContextMenu
} from '../utils/contextMenu'
import {
  clampMenuPosition,
  nextEnabledMenuIndex
} from '../utils/contextMenuModel'
import './ContextMenu.css'

const VIEWPORT_INSET = 8
const TITLEBAR_SAFE_INSET = 44
const ESTIMATED_WIDTH = 148
const ESTIMATED_ITEM_HEIGHT = 34

function estimatePosition(request) {
  return clampMenuPosition({
    x: request.x,
    y: request.y,
    width: ESTIMATED_WIDTH,
    height: Math.max(40, request.items.length * ESTIMATED_ITEM_HEIGHT),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    inset: VIEWPORT_INSET,
    topInset: TITLEBAR_SAFE_INSET
  })
}

export default function ContextMenu() {
  const [request, setRequest] = useState(null)
  const [position, setPosition] = useState({ left: 0, top: TITLEBAR_SAFE_INSET })
  const [activeIndex, setActiveIndex] = useState(-1)
  const menuRef = useRef(null)

  const close = useCallback(() => {
    setRequest(null)
    setActiveIndex(-1)
  }, [])

  useEffect(() => subscribeContextMenu(nextRequest => {
    setRequest(nextRequest)
    setPosition(estimatePosition(nextRequest))
    setActiveIndex(nextEnabledMenuIndex(nextRequest.items, -1, 1))
  }), [])

  useLayoutEffect(() => {
    if (!request || !menuRef.current) return
    const bounds = menuRef.current.getBoundingClientRect()
    setPosition(clampMenuPosition({
      x: request.x,
      y: request.y,
      width: bounds.width,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      inset: VIEWPORT_INSET,
      topInset: TITLEBAR_SAFE_INSET
    }))
  }, [request])

  useEffect(() => {
    if (!request) return undefined

    const handlePointerDown = event => {
      if (!menuRef.current?.contains(event.target)) close()
    }
    const handleBlur = () => close()
    const handleResize = () => close()
    const handleKeyDown = event => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        // The menu consumed the key: a dialog or the fullscreen editor under it must not act on it too.
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        setActiveIndex(current => nextEnabledMenuIndex(
          request.items,
          current,
          event.key === 'ArrowDown' ? 1 : -1
        ))
        return
      }

      if ((event.key === 'Enter' || event.key === ' ') && activeIndex >= 0) {
        event.preventDefault()
        event.stopPropagation()
        const item = request.items[activeIndex]
        close()
        void activateContextMenuItem(request, item)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('resize', handleResize)
    }
  }, [activeIndex, close, request])

  if (!request) return null

  const activate = (item) => {
    if (item.enabled === false) return
    close()
    void activateContextMenuItem(request, item)
  }

  return (
    <div
      ref={menuRef}
      className="app-context-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
      aria-label="上下文菜单"
      onPointerDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onContextMenu={event => event.preventDefault()}
    >
      {request.items.map((item, index) => item.type === 'separator' ? (
        <div className="app-context-menu-separator" role="separator" key={`separator-${index}`} />
      ) : (
        <button
          key={`${item.role || item.id}-${index}`}
          type="button"
          className={`app-context-menu-item${item.tone === 'danger' ? ' danger' : ''}${activeIndex === index ? ' keyboard-active' : ''}`}
          role="menuitem"
          disabled={item.enabled === false}
          onPointerEnter={() => item.enabled !== false && setActiveIndex(index)}
          onClick={() => activate(item)}
        >
          <span className="app-context-menu-label">{item.label}</span>
          {item.shortcut && <span className="app-context-menu-shortcut">{item.shortcut}</span>}
        </button>
      ))}
    </div>
  )
}
