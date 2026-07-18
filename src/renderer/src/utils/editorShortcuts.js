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
