export const FULLSCREEN_EDITOR_SHORTCUT_LABEL = 'Ctrl+Shift+Enter'

export function isFullscreenEditorShortcut(event) {
  return (
    !event.repeat &&
    !event.isComposing &&
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    !event.altKey &&
    event.key === 'Enter'
  )
}

// Ctrl+\ / Cmd+\ clears the formatting at the cursor.
export function isClearFormattingShortcut(event) {
  if (event.altKey || event.shiftKey) return false
  if (!event.ctrlKey && !event.metaKey) return false
  return event.code === 'Backslash' || event.key === '\\'
}

// What can be open over a fullscreen editor and takes Esc for itself: the slash menu (it handles the
// key while it is open), the right-click menu, and every dialog.
const ESC_OWNERS = ['.slash-menu', '.app-context-menu', '.modal-overlay', '.shortcuts-overlay', '.onboarding-overlay']

// Esc leaves fullscreen unless it was meant for something else: cancelling an input-method
// composition, or closing one of the things above. ProseMirror marks every Esc inside an editor as
// handled, so "already handled" cannot tell these apart; the question has to be asked before the
// editor sees the key, i.e. from a capturing listener.
export function isLeaveFullscreenKey(event, root = document) {
  if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return false
  return !ESC_OWNERS.some(selector => root.querySelector(selector))
}
