import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import { appState, automaticBackup } from '../appState.js'
import { backupFileName, collectJsonFiles, ensureDir, listBackups, writeBackupZip } from '../dataFiles.js'
import { isPathInside } from '../security.js'
import { attempt } from './attempt.js'

const fsp = fs.promises

// Backups, export and import move ZIP files as base64 (a plain Buffer would be copied through
// the IPC channel as an array of numbers). The renderer builds and reads the ZIP itself.
export function registerBackupIpc() {
  const backupsDir = () => path.join(appState.dataDir, 'backups')
  const assertInBackups = (backupPath) => {
    if (!isPathInside(backupsDir(), backupPath)) throw new Error('Backup path is outside the backups folder')
  }

  // The automatic history of a file: its versions, reading one, restoring one.
  ipcMain.handle('backup:automaticList', (_, filePath) => attempt(async () => ({
    data: await automaticBackup().list(filePath)
  })))
  ipcMain.handle('backup:automaticRead', (_, id) => attempt(async () => ({
    data: await automaticBackup().read(id)
  })))
  ipcMain.handle('backup:automaticRestore', (_, id) => attempt(async () => automaticBackup().restore(id)))

  // The files to zip, and where the backup is to be written.
  ipcMain.handle('backup:create', () => attempt(async () => {
    await ensureDir(backupsDir())
    return {
      files: await collectJsonFiles(appState.dataDir),
      backupPath: path.join(backupsDir(), backupFileName())
    }
  }))

  ipcMain.handle('backup:writeZip', (_, backupPath, base64Data) => attempt(async () => {
    // Only ever write inside the data directory's backups folder.
    assertInBackups(backupPath)
    await writeBackupZip(backupPath, base64Data)
    return {}
  }))

  ipcMain.handle('backup:list', async () => {
    try {
      return await listBackups(backupsDir())
    } catch (error) {
      console.error('Failed to list backups:', error)
      return []
    }
  })

  ipcMain.handle('backup:readZip', (_, backupPath) => attempt(async () => {
    assertInBackups(backupPath)
    return { data: (await fsp.readFile(backupPath)).toString('base64') }
  }))

  // Export and import use paths the user picked in a native dialog.
  ipcMain.handle('export:writeFile', (_, savePath, base64Data) => attempt(async () => {
    await fsp.writeFile(savePath, Buffer.from(base64Data, 'base64'))
    return {}
  }))

  ipcMain.handle('import:readFile', (_, filePath) => attempt(async () => ({
    data: (await fsp.readFile(filePath)).toString('base64')
  })))
}
