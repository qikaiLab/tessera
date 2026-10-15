import { useCallback, useState } from 'react'
import { useResizableWidth } from '../../utils/useResizableWidth'

/**
 * The notes drawer beside the day's records: it stays mounted while its closing animation
 * plays (`mounted` vs `open`), and its width is dragged and remembered.
 */
export function useNotesDrawer() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // The drawer sits on the right: dragging its edge to the left makes it wider.
  const { width, startResize } = useResizableWidth({
    storageKey: 'mototrace_today_notes_drawer_width',
    min: 270,
    max: 620,
    initial: 430,
    direction: -1
  })

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

  return { open, mounted, width, toggle, startResize, handleAnimationEnd }
}
