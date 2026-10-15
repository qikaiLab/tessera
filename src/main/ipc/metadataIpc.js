import fs from 'node:fs'
import path from 'node:path'
import { ipcMain, shell } from 'electron'
import { appState, automaticBackup } from '../appState.js'
import { openExternalUrl } from '../externalLinks.js'
import { attempt } from './attempt.js'

// metadata.json (countdowns, analytics charts, favourites), and the shell helpers.
export function registerMetadataIpc() {
  // A data directory without a metadata file simply has no metadata yet.
  ipcMain.handle('metadata:get', () => attempt(async () => {
    try {
      return { data: await fs.promises.readFile(path.join(appState.dataDir, 'metadata.json'), 'utf8') }
    } catch (error) {
      if (error.code === 'ENOENT') return { data: JSON.stringify({ countdowns: [], analytics: [] }) }
      throw error
    }
  }))

  ipcMain.handle('metadata:set', (_, content) => attempt(async () => {
    await automaticBackup().write('metadata.json', content)
    return {}
  }))

  ipcMain.handle('shell:showItemInFolder', (_, filePath) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('shell:openExternal', (_, url) => attempt(async () => {
    await openExternalUrl(url)
    return {}
  }))
}
