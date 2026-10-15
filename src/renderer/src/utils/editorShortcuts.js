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
