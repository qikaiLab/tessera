import { useEffect } from 'react'
import { isFullscreenEditorShortcut, isLeaveFullscreenKey } from '../../utils/editorShortcuts'

function useBodyClass(className, active) {
  useEffect(() => {
    if (!active) return undefined
    document.body.classList.add(className)
    return () => document.body.classList.remove(className)
  }, [className, active])
}

/**
 * What a fullscreen editor needs besides its own layout: Esc and Ctrl/Cmd+Shift+Enter leave it,
 * and the body carries classes the titlebar styles react to (`editor-fullscreen-active` for the
 * whole time, `editor-fullscreen-leaving` while the overlay fades out, so the titlebar already
 * starts to get its surface back).
 */
export function useFullscreenEditor({ isFullScreen, fullScreenLeaving, onToggleFullScreen }) {
  useBodyClass('editor-fullscreen-active', isFullScreen)
  useBodyClass('editor-fullscreen-leaving', isFullScreen && fullScreenLeaving)

  useEffect(() => {
    if (!isFullScreen || fullScreenLeaving || !onToggleFullScreen) return undefined
    // Esc is looked at before the editor handles it (capture), see isLeaveFullscreenKey.
    const handleEscape = (event) => {
      if (isLeaveFullscreenKey(event)) onToggleFullScreen()
    }
    const handleShortcut = (event) => {
      if (!event.defaultPrevented && isFullscreenEditorShortcut(event)) {
        event.preventDefault()
        onToggleFullScreen()
      }
    }
    window.addEventListener('keydown', handleEscape, true)
    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleEscape, true)
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [isFullScreen, fullScreenLeaving, onToggleFullScreen])
}
