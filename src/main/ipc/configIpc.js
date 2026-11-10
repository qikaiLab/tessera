import { ipcMain } from 'electron'
import { appState, loadConfig, saveConfig } from '../appState.js'
import { planDataDirectoryChange } from '../dataDirectoryMigration.js'
import { pathGrants } from '../pathGrants.js'
import { attempt } from './attempt.js'

// Settings the renderer may not write through `config:set`: where the data lives is only changed by
// the scheduled, verified move below (which takes effect at the next start).
const PROTECTED_KEYS = new Set(['dataDir', 'pendingDataDirChange'])

// The app config (settings kept next to the app, not in the data directory) and the location
// of the data directory itself.
export function registerConfigIpc() {
  ipcMain.handle('config:getDataDir', () => appState.dataDir)

  // What changing to `target` (a folder just picked in the folder dialog) would involve; changes nothing.
  ipcMain.handle('config:planDataDirChange', (_, target) => attempt(async () => {
    if (!pathGrants.has('folder', target)) throw new Error('Pick the folder in the folder dialog first')
    return { plan: await planDataDirectoryChange({ current: appState.dataDir, target }) }
  }))

  // Asks for the data to be moved at the next start: copied and checked then, and only a verified
  // copy becomes the data folder. Nothing is copied, switched or deleted now.
  ipcMain.handle('config:scheduleDataDirChange', (_, { target, copy } = {}) => attempt(async () => {
    if (!pathGrants.consume('folder', target)) throw new Error('Pick the folder in the folder dialog first')
    const plan = await planDataDirectoryChange({ current: appState.dataDir, target })
    const copying = plan.kind === 'empty' || plan.kind === 'resume'
    if (!copying && plan.kind !== 'existing') throw new Error(`This folder cannot be used (${plan.kind})`)
    if (copying !== (copy === true)) throw new Error('The folder changed since it was checked; pick it again')
    const pending = { from: appState.dataDir, to: target, copy: copying, requestedAt: new Date().toISOString() }
    saveConfig({ ...loadConfig(), pendingDataDirChange: pending })
    return { pending }
  }))

  ipcMain.handle('config:cancelDataDirChange', () => attempt(async () => {
    const { pendingDataDirChange: _removed, ...rest } = loadConfig()
    saveConfig(rest)
    return {}
  }))

  // The outcome of a move requested earlier, handed over once after startup.
  ipcMain.handle('config:takeDataDirNotice', () => {
    const notice = appState.dataDirNotice
    appState.dataDirNotice = null
    return notice
  })

  ipcMain.handle('config:get', () => loadConfig())

  ipcMain.handle('config:set', (_, key, value) => {
    if (PROTECTED_KEYS.has(key)) throw new Error(`"${key}" cannot be changed this way`)
    saveConfig({ ...loadConfig(), [key]: value })
    return true
  })
}
