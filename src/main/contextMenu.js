import { BrowserWindow, Menu } from 'electron'
import { buildContextMenuTemplate } from './contextMenuTemplate.js'

// Shows the menu at (x, y) of the window the request came from; false if there is nothing to show.
export function showContextMenu(event, { items, context, x, y } = {}) {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return false

  const template = buildContextMenuTemplate(items, context, event.sender)
  if (!template.length) return false

  const popupOptions = { window }
  if (Number.isFinite(x) && Number.isFinite(y)) {
    popupOptions.x = Math.round(x)
    popupOptions.y = Math.round(y)
  }
  Menu.buildFromTemplate(template).popup(popupOptions)
  return true
}
