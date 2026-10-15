// Reading and acting on the text selection of inputs, textareas and contenteditable elements:
// what the edit menu needs to cut, copy, paste and select all in the field it was opened on.
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"], .ProseMirror'
export const TEXT_MENU_SELECTOR = 'input, textarea, [contenteditable="true"], .selectable'

export function captureEditableSelection(target) {
  if (!target) return null
  const tagName = target.tagName?.toLowerCase()

  if (tagName === 'input' || tagName === 'textarea') {
    let start = null
    let end = null
    let direction = 'none'
    try {
      start = target.selectionStart
      end = target.selectionEnd
      direction = target.selectionDirection || 'none'
    } catch {
      // Some input types do not expose text selection.
    }
    return { kind: 'input', target, start, end, direction }
  }

  if (target.isContentEditable || target.closest?.('.ProseMirror')) {
    const selection = window.getSelection?.()
    let range = null
    if (selection?.rangeCount) {
      const candidate = selection.getRangeAt(0)
      if (target.contains(candidate.commonAncestorContainer)) range = candidate.cloneRange()
    }
    return { kind: 'contenteditable', target, range }
  }

  return null
}

function restoreEditableSelection(snapshot) {
  if (!snapshot?.target?.isConnected) return false
  focusEditableTarget(snapshot.target)

  if (snapshot.kind === 'input') {
    if (!Number.isFinite(snapshot.start) || !Number.isFinite(snapshot.end)) return true
    try {
      snapshot.target.setSelectionRange(snapshot.start, snapshot.end, snapshot.direction)
    } catch {
      // Non-text inputs can be focused but do not accept a selection range.
    }
    return true
  }

  if (snapshot.kind === 'contenteditable' && snapshot.range) {
    try {
      const selection = window.getSelection?.()
      selection?.removeAllRanges()
      selection?.addRange(snapshot.range)
    } catch {
      return false
    }
  }
  return true
}

function readClipboardText() {
  try {
    return String(window.api?.clipboard?.readText?.() || '')
  } catch {
    return ''
  }
}

export function hasClipboardText() {
  return readClipboardText().length > 0
}

async function writeClipboardText(text) {
  if (window.api?.clipboard?.writeText) {
    return window.api.clipboard.writeText(text)
  }
  return navigator.clipboard?.writeText?.(text)
}

function dispatchInput(target, inputType, data = null) {
  const eventInit = { bubbles: true, inputType, data }
  try {
    target.dispatchEvent(new InputEvent('input', eventInit))
  } catch {
    target.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function replaceInputSelection(snapshot, replacement, inputType) {
  const target = snapshot.target
  const value = String(target.value ?? '')
  const start = Number.isFinite(snapshot.start) ? snapshot.start : value.length
  const end = Number.isFinite(snapshot.end) ? snapshot.end : start
  target.setRangeText(replacement, start, end, 'end')
  snapshot.start = start + replacement.length
  snapshot.end = snapshot.start
  dispatchInput(target, inputType, replacement || null)
}

export async function executeTextRole(role, snapshot) {
  if (!snapshot || !restoreEditableSelection(snapshot)) return
  const target = snapshot.target

  if (role === 'undo' || role === 'redo') {
    document.execCommand(role)
    return
  }

  if (role === 'selectAll') {
    if (snapshot.kind === 'input') {
      target.select?.()
      return
    }
    const range = document.createRange()
    range.selectNodeContents(target)
    const selection = window.getSelection?.()
    selection?.removeAllRanges()
    selection?.addRange(range)
    return
  }

  if (role === 'paste') {
    const text = readClipboardText()
    if (!text) return
    if (snapshot.kind === 'input') {
      replaceInputSelection(snapshot, text, 'insertFromPaste')
    } else {
      document.execCommand('insertText', false, text)
    }
    return
  }

  if (role !== 'copy' && role !== 'cut') return

  let selectedText = ''
  if (snapshot.kind === 'input') {
    const value = String(target.value ?? '')
    selectedText = value.slice(snapshot.start ?? 0, snapshot.end ?? 0)
  } else if (snapshot.range) {
    selectedText = snapshot.range.toString()
  }
  if (!selectedText) return

  await writeClipboardText(selectedText)
  if (role === 'cut') {
    if (snapshot.kind === 'input') {
      replaceInputSelection(snapshot, '', 'deleteByCut')
    } else {
      document.execCommand('delete')
    }
  }
}

export function isEditableMenuTarget(target) {
  return Boolean(target?.closest?.(EDITABLE_SELECTOR))
}

function selectionIntersects(target, selection) {
  if (!target || !selection || selection.rangeCount === 0 || selection.isCollapsed) return false
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    const ancestor = range.commonAncestorContainer
    if (target.contains(ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentNode)) {
      return true
    }
  }
  return false
}

function commandEnabled(command, canEdit) {
  if (!canEdit) return false
  try {
    return document.queryCommandEnabled(command)
  } catch {
    return canEdit
  }
}

function getInputSelectionState(target) {
  const value = String(target.value ?? '')
  let hasSelection = false
  try {
    hasSelection = Number.isFinite(target.selectionStart) &&
      Number.isFinite(target.selectionEnd) &&
      target.selectionEnd > target.selectionStart
  } catch {
    hasSelection = false
  }

  const canEdit = !target.disabled && !target.readOnly
  return {
    target,
    canEdit,
    hasSelection,
    canUndo: commandEnabled('undo', canEdit),
    canRedo: commandEnabled('redo', canEdit),
    canCut: canEdit && hasSelection,
    canCopy: hasSelection,
    canPaste: canEdit && hasClipboardText(),
    canSelectAll: value.length > 0
  }
}

export function getEditableSelectionState(target) {
  const menuTarget = target?.closest?.(TEXT_MENU_SELECTOR)
  if (!menuTarget) return null

  const tagName = menuTarget.tagName?.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') {
    return getInputSelectionState(menuTarget)
  }

  const isProseMirror = Boolean(menuTarget.closest?.('.ProseMirror'))
  const isContentEditable = menuTarget.isContentEditable
  const selection = window.getSelection?.()
  const hasSelection = selectionIntersects(menuTarget, selection)
  const hasText = (menuTarget.innerText || menuTarget.textContent || '').length > 0
  const canEdit = isContentEditable && menuTarget.getAttribute('aria-readonly') !== 'true'

  return {
    target: menuTarget,
    canEdit,
    hasSelection,
    canUndo: commandEnabled('undo', canEdit),
    canRedo: commandEnabled('redo', canEdit),
    canCut: canEdit && hasSelection,
    canCopy: hasSelection,
    canPaste: canEdit && hasClipboardText(),
    canSelectAll: isContentEditable && hasText,
    isProseMirror
  }
}

export function focusEditableTarget(target) {
  if (!target || typeof target.focus !== 'function') return
  try {
    target.focus({ preventScroll: true })
  } catch {
    target.focus()
  }
}
