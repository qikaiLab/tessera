import { useCallback, useEffect, useRef, useState } from 'react'
import { isLeaveFullscreenKey } from '../../utils/editorShortcuts'

/**
 * Which section's editor is fullscreen. Fullscreen ends when the day changes and on Escape,
 * after which focus returns to an editor on the page.
 */
export function useSectionFullscreen(dateStr) {
  const [fullScreenSectionId, setFullScreenSectionId] = useState(null)
  const refocusTimerRef = useRef(null)

  useEffect(() => {
    setFullScreenSectionId(null)
  }, [dateStr])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!fullScreenSectionId || !isLeaveFullscreenKey(event)) return
      setFullScreenSectionId(null)
      refocusTimerRef.current = setTimeout(() => {
        document.querySelector('.section-card:not(.fullscreen-active-parent) .ProseMirror')?.focus()
      }, 50)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      clearTimeout(refocusTimerRef.current)
      refocusTimerRef.current = null
    }
  }, [fullScreenSectionId])

  const toggleFullscreen = useCallback((sectionId) => {
    setFullScreenSectionId(current => (current === sectionId ? null : sectionId))
  }, [])

  return { fullScreenSectionId, toggleFullscreen }
}
