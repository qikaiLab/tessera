import path from 'node:path'
import { app } from 'electron'
import { createAutomaticBackupStore } from './automaticBackup.js'
import { readConfigFile, writeConfigFile } from './configStore.js'
import { resolveSafePath } from './security.js'

// What the main process shares between its parts: the window, the data directory, whether a
// close has been confirmed by the renderer, and whether this run uses the Vite dev server.
export const appState = {
  mainWindow: null,
  dataDir: '',
  isQuitting: false,
  isDev: false
}

// ─── Config (kept in the app's userData folder, not in the data directory) ────

const configPath = () => path.join(app.getPath('userData'), 'config.json')

export const loadConfig = () => readConfigFile(configPath())

export const saveConfig = (config) => writeConfigFile(configPath(), config)

// A path inside the data directory; throws for anything that would leave it.
export const safePath = (filePath) => resolveSafePath(appState.dataDir, filePath)

// ─── Automatic history, one store per data directory ──────────────────────────

const backupStores = new Map()

// Every write and delete of user data goes through this store, which keeps a checkpoint of
// what it replaces.
export function automaticBackup() {
  const directory = path.resolve(appState.dataDir)
  if (!backupStores.has(directory)) backupStores.set(directory, createAutomaticBackupStore(directory))
  return backupStores.get(directory)
}
