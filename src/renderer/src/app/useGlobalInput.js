import { useEffect } from 'react'
import { getZoomDeltaFromKeyboardEvent, getZoomDeltaFromWheelEvent } from '../theme/interfacePreferences'
import { editMenuItems, focusEditableTarget, getEditableSelectionState, showContextMenu } from '../utils/contextMenu'

/**
 * Input that works on every page: Ctrl +/- and Ctrl+wheel zoom the interface, F1 opens the
 * guide, Ctrl+/ toggles the shortcut list, and a right click in a plain text field opens the
 * edit menu (the rich-text editor brings its own).
 */
export function useGlobalInput({ adjustInterfaceZoom, onOpenGuide, onToggleShortcuts }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const zoomDelta = getZoomDeltaFromKeyboardEvent(event)
      if (zoomDelta) {
        event.preventDefault()
        adjustInterfaceZoom(zoomDelta)
      } else if (event.key === 'F1') {
        event.preventDefault()
        onOpenGuide()
      } else if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault()
        onToggleShortcuts()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [adjustInterfaceZoom, onOpenGuide, onToggleShortcuts])

  useEffect(() => {
    const handleWheel = (event) => {
      const zoomDelta = getZoomDeltaFromWheelEvent(event)
      if (!zoomDelta) return
      event.preventDefault()
      adjustInterfaceZoom(zoomDelta)
    }

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', handleWheel, { capture: true })
  }, [adjustInterfaceZoom])

  useEffect(() => {
    const handleTextContextMenu = (event) => {
      if (event.defaultPrevented) return

      const selectionState = getEditableSelectionState(event.target)
      if (!selectionState || selectionState.isProseMirror) return

      focusEditableTarget(selectionState.target)
      showContextMenu(event, editMenuItems({
        canUndo: selectionState.canUndo,
        canRedo: selectionState.canRedo,
        canCut: selectionState.canCut,
        canCopy: selectionState.canCopy,
        canPaste: selectionState.canPaste,
        canSelectAll: selectionState.canSelectAll
      }), { scope: 'native-edit' })
    }

    window.addEventListener('contextmenu', handleTextContextMenu)
    return () => window.removeEventListener('contextmenu', handleTextContextMenu)
  }, [])
}
