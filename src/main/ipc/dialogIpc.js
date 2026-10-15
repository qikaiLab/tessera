import { dialog, ipcMain } from 'electron'
import { appState } from '../appState.js'

// Native dialogs, parented to the main window. A cancelled dialog answers null.
export function registerDialogIpc() {
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(appState.mainWindow, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_, options) => {
    const result = await dialog.showSaveDialog(appState.mainWindow, options)
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:openFile', async (_, options) => {
    const result = await dialog.showOpenDialog(appState.mainWindow, options)
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:confirm', async (_, { message, buttons = ['确定', '取消'], title = '提示' }) => {
    const { response } = await dialog.showMessageBox(appState.mainWindow, {
      type: 'question',
      buttons,
      defaultId: 0,
      cancelId: 1,
      title,
      message,
      noLink: true
    })
    return response === 0
  })
}
