import { useEffect } from 'react'

export const separator = { type: 'separator' }

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"], .ProseMirror'
const TEXT_MENU_SELECTOR = 'input, textarea, [contenteditable="true"], .selectable'

export function editMenuItems({
  canUndo = true,
  canRedo = true,
  canCut = true,
  canCopy = true,
  canPaste = true,
  canSelectAll = true
} = {}) {
  return [
    { label: '撤销', role: 'undo', enabled: canUndo },
    { label: '重做', role: 'redo', enabled: canRedo },
    separator,
    { label: '剪切', role: 'cut', enabled: canCut },
    { label: '复制', role: 'copy', enabled: canCopy },
    { label: '粘贴', role: 'paste', enabled: canPaste },
    separator,
    { label: '全选', role: 'selectAll', enabled: canSelectAll }
  ]
}

export function showContextMenu(event, items, context = {}) {
  event?.preventDefault?.()
  event?.stopPropagation?.()

  return window.api?.contextMenu?.show?.({
    items,
    context,
    x: event?.clientX,
    y: event?.clientY
  })
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
    canCut: canEdit && hasSelection,
    canCopy: hasSelection,
    canPaste: canEdit,
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
    canCut: canEdit && hasSelection,
    canCopy: hasSelection,
    canPaste: canEdit,
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

export function useContextMenuCommand(scope, handler) {
  useEffect(() => {
    if (!window.api?.contextMenu?.onCommand) return undefined

    return window.api.contextMenu.onCommand(({ id, context }) => {
      if (context?.scope !== scope) return
      handler(id, context)
    })
  }, [scope, handler])
}
