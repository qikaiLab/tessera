import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain } from 'electron'
import { appState, loadConfig, saveConfig } from '../appState.js'
import { ensureDir } from '../dataFiles.js'

// The app config (settings kept next to the app, not in the data directory) and the location
// of the data directory itself.
export function registerConfigIpc() {
  ipcMain.handle('config:getDataDir', () => appState.dataDir)

  ipcMain.handle('config:setDataDir', async (_, newDir) => {
    await ensureDir(newDir)
    appState.dataDir = newDir
    saveConfig({ ...loadConfig(), dataDir: newDir })
    try {
      await fs.promises.writeFile(path.join(app.getPath('userData'), 'datapath.txt'), newDir, 'utf8')
    } catch (error) {
      console.error('Failed to write datapath.txt:', error)
    }
    return true
  })

  ipcMain.handle('config:get', () => loadConfig())

  ipcMain.handle('config:set', (_, key, value) => {
    saveConfig({ ...loadConfig(), [key]: value })
    return true
  })
}
