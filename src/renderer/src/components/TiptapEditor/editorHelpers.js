import { TextSelection } from '@tiptap/pm/state'
import { fileUrlToLocalPath, isLocalFileHref, localPathLabel, localPathToFileUrl } from '../../utils/localFileLinks'

/** The link target to open for a clicked href, or null when it is not an openable web / mail / phone link. */
export function normalizeExternalUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return null
}

/**
 * What a link's address should be stored as: a web / mail / phone address, or a `file:///` URL
 * for a path on this computer (given as a Windows path or already as a file URL). Null when it
 * is neither, which includes every unsafe scheme.
 */
export function normalizeLinkHref(address) {
  const text = String(address ?? '').trim()
  if (!text) return null
  const web = normalizeExternalUrl(text)
  if (web) return web
  if (isLocalFileHref(text)) return localPathToFileUrl(fileUrlToLocalPath(text))
  return localPathToFileUrl(text)
}

/** What a clicked link points at: { kind: 'web', url }, { kind: 'file', path } or null. */
export function resolveLinkTarget(href) {
  const url = normalizeExternalUrl(href)
  if (url) return { kind: 'web', url }
  const path = fileUrlToLocalPath(href)
  return path ? { kind: 'file', path } : null
}

/** Inserts a link to a file or folder on this computer at the cursor, named after it. */
export function insertLocalPathLink(editor, localPath) {
  const href = localPathToFileUrl(localPath)
  if (!editor || !href) return false
  return editor.chain().focus().insertContent({
    type: 'text',
    text: localPathLabel(localPath),
    marks: [{ type: 'link', attrs: { href } }]
  }).run()
}

const OPEN_FAILURES = {
  'not-found': '找不到该文件或文件夹，可能已被移动或删除',
  'network-path': '不支持网络路径',
  'invalid-path': '无法打开这个路径',
  'open-failed': '系统无法打开该文件'
}

/**
 * Follows a link: web addresses open in the system browser, local paths in their default app or
 * in Explorer. `showToast` reports what could not be opened. Returns whether the link was one
 * we handle, so the caller knows whether to cancel the click.
 */
export function openLinkHref(href, showToast) {
  const target = resolveLinkTarget(href)
  if (!target) return false
  if (target.kind === 'web') {
    window.api?.shell?.openExternal?.(target.url)
    return true
  }
  const openLocalFile = window.api?.shell?.openLocalFile
  if (typeof openLocalFile !== 'function') {
    // An app window that was started before this feature existed has no way to open files.
    showToast?.('当前窗口不支持打开本地文件，请重启应用后再试', 'error')
    return true
  }
  Promise.resolve(openLocalFile(target.path)).then(result => {
    if (!result) return
    if (!result.ok) showToast?.(OPEN_FAILURES[result.error] || OPEN_FAILURES['open-failed'], 'error')
    else if (result.mode === 'revealed') showToast?.('这类文件不会被直接打开，已在文件夹中显示', 'info')
  }).catch(() => showToast?.(OPEN_FAILURES['open-failed'], 'error'))
  return true
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

// Pasted text as paragraphs, one per line (Windows clipboards use CRLF): raw line breaks must not
// end up inside a single text node, where only the editor's own styling makes them look like lines.
export function plainTextToParagraphs(text) {
  // A line break at the very end (copying a whole line) does not add an empty paragraph.
  return String(text ?? '').replace(/(\r\n?|\n)$/, '').split(/\r\n?|\n/).map(line => (
    line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }
  ))
}

export function insertPlainText(editor, text) {
  if (!editor) return false
  const paragraphs = plainTextToParagraphs(text)
  if (paragraphs.length > 1) return editor.chain().focus().insertContent(paragraphs).run()
  const single = paragraphs[0].content?.[0]?.text ?? ''
  // An empty clipboard pastes nothing; it must not delete the selection.
  if (!single) return false
  return editor.chain().focus().command(({ state, dispatch }) => {
    if (dispatch) {
      dispatch(state.tr.insertText(single, state.selection.from, state.selection.to))
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
