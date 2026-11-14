import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import { appState, automaticBackup } from '../appState.js'
import { backupFileName, collectJsonFiles, ensureDir, listBackups, writeBackupZip } from '../dataFiles.js'
import { pathGrants } from '../pathGrants.js'
import { isPathInside } from '../security.js'
import { attempt } from './attempt.js'

const fsp = fs.promises

// An import is read into memory whole and handed to the renderer as base64: a file over this size is
// refused before it is read (the renderer applies its own, stricter limits to what is inside).
export const MAX_IMPORT_FILE_BYTES = 128 * 1024 * 1024

// Backups, export and import move ZIP files as base64 (a plain Buffer would be copied through
// the IPC channel as an array of numbers). The renderer builds and reads the ZIP itself.
export function registerBackupIpc() {
  const backupsDir = () => path.join(appState.dataDir, 'backups')
  // A backup is a ZIP lying directly in the backups folder; the automatic history below it (and any
  // other file) is never reachable through these calls.
  const assertInBackups = (backupPath) => {
    if (typeof backupPath !== 'string' || !isPathInside(backupsDir(), backupPath)) throw new Error('Backup path is outside the backups folder')
    const resolved = path.resolve(backupPath)
    if (path.dirname(resolved).toLowerCase() !== path.resolve(backupsDir()).toLowerCase() || !resolved.toLowerCase().endsWith('.zip')) {
      throw new Error('Backup path must be a ZIP file in the backups folder')
    }
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

  // Export and import use paths the user picked in a native dialog, and nothing else.
  ipcMain.handle('export:writeFile', (_, savePath, base64Data) => attempt(async () => {
    if (!pathGrants.consume('write', savePath)) throw new Error('Export path was not chosen in a save dialog')
    await fsp.writeFile(savePath, Buffer.from(base64Data, 'base64'))
    return {}
  }))

  ipcMain.handle('import:readFile', (_, filePath) => attempt(async () => {
    if (!pathGrants.consume('read', filePath)) throw new Error('Import path was not chosen in an open dialog')
    const { size } = await fsp.stat(filePath)
    if (size > MAX_IMPORT_FILE_BYTES) {
      throw Object.assign(new Error('Import file is too large'), { code: 'TESSERA_FILE_TOO_LARGE' })
    }
    return { data: (await fsp.readFile(filePath)).toString('base64') }
  }))
}
