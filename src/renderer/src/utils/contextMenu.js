import { useEffect } from 'react'
import { normalizeContextMenuItems } from './contextMenuModel'
import { TEXT_MENU_SELECTOR, captureEditableSelection, executeTextRole } from './editableText'

// The application's own context menu: callers describe a menu with showContextMenu(), the menu
// host (components/ContextMenu.jsx) draws it, and a chosen command comes back to the handler
// registered with useContextMenuCommand() for the same scope. Acting on the text of the field a
// menu was opened on lives in editableText.js.
export const separator = { type: 'separator' }

const menuSubscribers = new Set()
const commandSubscribers = new Set()
let nativeCommandBridgeReady = false
let requestSequence = 0

export function editMenuItems({
  canUndo = true,
  canRedo = true,
  canCut = true,
  canCopy = true,
  canPaste = true,
  canSelectAll = true
} = {}) {
  return [
    { label: '撤销', role: 'undo', enabled: canUndo, shortcut: 'Ctrl+Z' },
    { label: '重做', role: 'redo', enabled: canRedo, shortcut: 'Ctrl+Y' },
    separator,
    { label: '剪切', role: 'cut', enabled: canCut, shortcut: 'Ctrl+X' },
    { label: '复制文本', role: 'copy', enabled: canCopy, shortcut: 'Ctrl+C' },
    { label: '粘贴', role: 'paste', enabled: canPaste, shortcut: 'Ctrl+V' },
    separator,
    { label: '全选', role: 'selectAll', enabled: canSelectAll, shortcut: 'Ctrl+A' }
  ]
}

function ensureNativeCommandBridge() {
  if (nativeCommandBridgeReady || !window.api?.contextMenu?.onCommand) return
  nativeCommandBridgeReady = true
  window.api.contextMenu.onCommand(({ id, context }) => {
    dispatchContextMenuCommand(id, context)
  })
}

export function subscribeContextMenu(listener) {
  ensureNativeCommandBridge()
  menuSubscribers.add(listener)
  return () => menuSubscribers.delete(listener)
}

export function dispatchContextMenuCommand(id, context = {}) {
  commandSubscribers.forEach(subscription => {
    if (subscription.scope === context?.scope) subscription.handler(id, context)
  })
}

export async function activateContextMenuItem(request, item) {
  if (!request || !item || item.type === 'separator' || item.enabled === false) return

  if (item.role) {
    await executeTextRole(item.role, request.editableSelection)
    return
  }
  if (item.id) dispatchContextMenuCommand(item.id, request.context)
}

export function showContextMenu(event, items, context = {}) {
  event?.preventDefault?.()
  event?.stopPropagation?.()

  const normalizedItems = normalizeContextMenuItems(items)
  if (!normalizedItems.length) return false

  const request = {
    requestId: ++requestSequence,
    items: normalizedItems,
    context,
    x: Number.isFinite(event?.clientX) ? event.clientX : 0,
    y: Number.isFinite(event?.clientY) ? event.clientY : 0,
    editableSelection: captureEditableSelection(event?.target?.closest?.(TEXT_MENU_SELECTOR))
  }

  if (menuSubscribers.size > 0) {
    menuSubscribers.forEach(listener => listener(request))
    return true
  }

  // Emergency fallback for early startup or a renderer failure: retain the
  // native Electron menu path, but the mounted app always uses the custom host.
  return window.api?.contextMenu?.show?.({
    items: normalizedItems,
    context,
    x: request.x,
    y: request.y
  })
}

export function useContextMenuCommand(scope, handler) {
  useEffect(() => {
    ensureNativeCommandBridge()
    const subscription = { scope, handler }
    commandSubscribers.add(subscription)
    return () => commandSubscribers.delete(subscription)
  }, [scope, handler])
}
