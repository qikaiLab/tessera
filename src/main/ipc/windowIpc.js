import { ipcMain } from 'electron'
import { appState } from '../appState.js'
import { showContextMenu } from '../contextMenu.js'
import { clearCloseRequest } from '../window.js'

// Window controls (the window is frameless), the close handshake and native context menus.
export function registerWindowIpc() {
  ipcMain.handle('window:minimize', () => appState.mainWindow.minimize())
  ipcMain.handle('window:maximize', () => {
    const window = appState.mainWindow
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.handle('window:close', () => appState.mainWindow.close())
  ipcMain.handle('window:isMaximized', () => appState.mainWindow.isMaximized())

  // The renderer has flushed its pending saves: the close may go ahead.
  ipcMain.handle('app:confirmClose', () => {
    clearCloseRequest()
    appState.isQuitting = true
    appState.mainWindow?.close()
  })
  // A flush failed: stay open.
  ipcMain.handle('app:cancelClose', () => {
    clearCloseRequest()
    return true
  })

  ipcMain.handle('context-menu:show', showContextMenu)
}
