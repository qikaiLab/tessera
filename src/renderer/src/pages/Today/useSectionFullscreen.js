import { useCallback, useEffect, useRef, useState } from 'react'

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
      if (event.key !== 'Escape' || !fullScreenSectionId) return
      setFullScreenSectionId(null)
      refocusTimerRef.current = setTimeout(() => {
        document.querySelector('.section-card:not(.fullscreen-active-parent) .ProseMirror')?.focus()
      }, 50)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(refocusTimerRef.current)
      refocusTimerRef.current = null
    }
  }, [fullScreenSectionId])

  const toggleFullscreen = useCallback((sectionId) => {
    setFullScreenSectionId(current => (current === sectionId ? null : sectionId))
  }, [])

  return { fullScreenSectionId, toggleFullscreen }
}
