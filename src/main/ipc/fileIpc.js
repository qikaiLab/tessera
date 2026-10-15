import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import { appState, automaticBackup, safePath } from '../appState.js'
import { findTemporaryFiles, readDirOrEmpty, scanDayDates } from '../dataFiles.js'
import { attempt } from './attempt.js'

const fsp = fs.promises

// A temporary file path from the renderer must lie inside the data directory.
function assertInsideDataDir(tmpPath) {
  const dataDir = path.resolve(appState.dataDir)
  const resolved = path.resolve(tmpPath)
  if (!resolved.startsWith(dataDir + path.sep)) throw new Error('Path traversal detected')
  return { dataDir, resolved }
}

// Reading and writing the data directory. Paths are relative to it and cannot leave it; every
// write and delete goes through the automatic history.
export function registerFileIpc() {
  ipcMain.handle('fs:readFile', (_, filePath) => attempt(async () => ({
    data: await fsp.readFile(safePath(filePath), 'utf8')
  })))

  ipcMain.handle('fs:writeFile', (_, filePath, content) => attempt(async () => {
    await automaticBackup().write(filePath, content)
    return {}
  }))

  ipcMain.handle('fs:deleteFile', (_, filePath) => attempt(async () => {
    await automaticBackup().delete(filePath)
    return {}
  }))

  ipcMain.handle('fs:listDir', (_, dir) => attempt(async () => ({
    data: await readDirOrEmpty(safePath(dir))
  })))

  ipcMain.handle('fs:exists', async (_, filePath) => {
    try {
      await fsp.access(safePath(filePath))
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:scanDates', () => scanDayDates(appState.dataDir))

  // Crash recovery: leftover .tmp files can be restored into the file they were replacing, or
  // discarded.
  ipcMain.handle('fs:checkTmpFiles', () => findTemporaryFiles(appState.dataDir))

  ipcMain.handle('fs:recoverTmp', (_, tmpPath) => attempt(async () => {
    const { dataDir, resolved } = assertInsideDataDir(tmpPath)
    await automaticBackup().recoverTemporary(path.relative(dataDir, resolved))
    return {}
  }))

  ipcMain.handle('fs:discardTmp', (_, tmpPath) => attempt(async () => {
    assertInsideDataDir(tmpPath)
    await fsp.unlink(tmpPath)
    return {}
  }))
}
