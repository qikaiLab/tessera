import { app, dialog, ipcMain } from 'electron'
import { appState } from '../appState.js'
import {
  importBackgroundImage,
  readManagedBackground,
  removeManagedBackgrounds
} from '../appearanceBackground.js'
import { attempt } from './attempt.js'

// The frosted-glass background picture is copied into app-owned storage, so moving or deleting
// the original file cannot break a saved background.
export function registerAppearanceIpc() {
  ipcMain.handle('appearanceBackground:get', () => attempt(async () => ({
    background: await readManagedBackground(app.getPath('userData'))
  })))

  ipcMain.handle('appearanceBackground:import', async () => {
    const result = await dialog.showOpenDialog(appState.mainWindow, {
      title: '选择雾化玻璃背景图',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true }

    return attempt(async () => ({
      canceled: false,
      background: await importBackgroundImage(result.filePaths[0], app.getPath('userData'))
    }))
  })

  ipcMain.handle('appearanceBackground:clear', () => attempt(async () => {
    await removeManagedBackgrounds(app.getPath('userData'))
    return {}
  }))
}
