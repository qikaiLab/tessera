import { TextSelection } from '@tiptap/pm/state'

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

/** The link target to open for a clicked href, or null when it is not an openable web / mail / phone link. */
export function normalizeExternalUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return null
}

// Settings keep widths and letter spacing as plain text; a bare number means pixels.
function withPixelUnit(value, pattern, fallback) {
  if (!value) return fallback
  const trimmed = value.trim()
  return pattern.test(trimmed) ? `${trimmed}px` : trimmed
}

export function formatCssWidth(value, fallback = '700px') {
  return withPixelUnit(value, /^\d+$/, fallback)
}

export function formatCssLetterSpacing(value, fallback = '0px') {
  return withPixelUnit(value, /^\d+(\.\d+)?$/, fallback)
}

export function countChars(editor) {
  if (!editor) return 0
  return editor.storage.characterCount?.characters?.() ?? 0
}

export function canRunEditorCommand(editor, command) {
  try {
    const can = editor?.can?.()
    return typeof can?.[command] === 'function' ? can[command]() : true
  } catch {
    return true
  }
}

export function getSelectedEditorText(editor) {
  const selection = editor?.state?.selection
  if (!editor || !selection || selection.empty) return ''
  return editor.state.doc.textBetween(selection.from, selection.to, '\n\n')
}

export function insertPlainText(editor, text) {
  if (!editor) return false
  return editor.chain().focus().command(({ state, dispatch }) => {
    if (dispatch) {
      dispatch(state.tr.insertText(String(text ?? ''), state.selection.from, state.selection.to))
    }
    return true
  }).run()
}

export function isTaskCheckbox(target) {
  return Boolean(target?.closest?.('ul[data-type="taskList"] li > label'))
}

// Ticking a to-do makes Tiptap's TaskItem focus the editor at its current selection. In an
// editor that has never had focus that selection is the very start of the document, so the
// view jumped back to the top. Moving the selection into the clicked item first (no focus, no
// scrolling) makes that focus a no-op for the scroll position.
export function selectTaskItemUnderPointer(editor, target) {
  if (!editor || editor.isDestroyed || editor.isFocused || !isTaskCheckbox(target)) return
  try {
    const item = target.closest('li')
    const pos = editor.view.posAtDOM(item, 0)
    editor.chain().command(({ tr, dispatch }) => {
      if (dispatch) tr.setSelection(TextSelection.near(tr.doc.resolve(pos), 1))
      return true
    }).run()
  } catch {
    // Selection is a nicety; the tick itself must still go through.
  }
}
