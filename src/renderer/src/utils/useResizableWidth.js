import { useCallback, useState } from 'react'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * A panel width the user drags with a handle, remembered across sessions.
 *
 * `direction` is 1 when dragging to the right makes the panel wider (a panel on the left) and
 * -1 when dragging to the left does (a panel on the right).
 */
export function useResizableWidth({ storageKey, min, max, initial, direction = 1 }) {
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(storageKey) || '', 10)
    return Number.isFinite(saved) ? clamp(saved, min, max) : initial
  })

  const startResize = useCallback((event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    document.body.classList.add('is-resizing')

    const handleMove = (moveEvent) => {
      const nextWidth = clamp(startWidth + direction * (moveEvent.clientX - startX), min, max)
      setWidth(nextWidth)
      localStorage.setItem(storageKey, String(nextWidth))
    }
    const handleUp = () => {
      document.body.classList.remove('is-resizing')
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [direction, max, min, storageKey, width])

  return { width, startResize }
}
