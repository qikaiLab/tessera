import { useCallback, useState } from 'react'

const NOTES_DRAWER_MIN = 270
const NOTES_DRAWER_MAX = 620
const NOTES_DRAWER_DEFAULT = 430
const WIDTH_STORAGE_KEY = 'mototrace_today_notes_drawer_width'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function readStoredWidth() {
  const saved = parseInt(localStorage.getItem(WIDTH_STORAGE_KEY) || '', 10)
  return Number.isFinite(saved) ? clamp(saved, NOTES_DRAWER_MIN, NOTES_DRAWER_MAX) : NOTES_DRAWER_DEFAULT
}

/**
 * The notes drawer beside the day's records: it stays mounted while its closing animation
 * plays (`mounted` vs `open`), and its width is dragged and remembered.
 */
export function useNotesDrawer() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [width, setWidth] = useState(readStoredWidth)

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false)
      return
    }
    setMounted(true)
    setOpen(true)
  }, [open])

  // Called when the drawer's own animation ends: after closing it can be unmounted.
  const handleAnimationEnd = useCallback(() => {
    if (!open) setMounted(false)
  }, [open])

  const startResize = useCallback((event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    document.body.classList.add('is-resizing')

    const handleMove = (moveEvent) => {
      const nextWidth = clamp(startWidth - (moveEvent.clientX - startX), NOTES_DRAWER_MIN, NOTES_DRAWER_MAX)
      setWidth(nextWidth)
      localStorage.setItem(WIDTH_STORAGE_KEY, String(nextWidth))
    }
    const handleUp = () => {
      document.body.classList.remove('is-resizing')
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [width])

  return { open, mounted, width, toggle, startResize, handleAnimationEnd }
}
