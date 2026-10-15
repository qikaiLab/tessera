import path from 'node:path'
import os from 'node:os'
import { BrowserWindow, app, dialog } from 'electron'
import { appState, loadConfig, saveConfig } from './appState.js'
import { ensureDirSync } from './dataFiles.js'
import { resolveDataDirectory } from './dataDirectory.js'
import { isAppNavigationUrl, openExternalQuietly } from './externalLinks.js'

// How long the renderer has to confirm that pending edits were saved before the user is told
// the close was cancelled.
const CLOSE_CONFIRM_TIMEOUT_MS = 15000
let closeRequestTimer = null

export function clearCloseRequest() {
  clearTimeout(closeRequestTimer)
  closeRequestTimer = null
}

// Brings the existing window forward (a second launch of the app lands here).
export function focusMainWindow() {
  const window = appState.mainWindow
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) window.show()
  window.focus()
}

// Closing asks the renderer to flush pending saves first; the window only closes when it
// confirms (app:confirmClose). A slow or failed save is never permission to discard edits.
function guardClose(window) {
  window.on('close', (event) => {
    if (appState.isQuitting) return // Already confirmed, let it close

    event.preventDefault()
    if (closeRequestTimer) return
    window.webContents.send('app-before-close')

    closeRequestTimer = setTimeout(() => {
      closeRequestTimer = null
      if (appState.mainWindow && !appState.mainWindow.isDestroyed()) {
        dialog.showMessageBox(appState.mainWindow, {
          type: 'warning',
          title: '尚未确认保存完成',
          message: '应用仍在等待保存结果，已取消退出。请检查保存状态后重试。',
          buttons: ['继续使用']
        })
      }
    }, CLOSE_CONFIRM_TIMEOUT_MS)
  })
}

// Only the app's own pages load in the window; links go to the system browser.
function restrictNavigation(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalQuietly(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppNavigationUrl(url)) return
    event.preventDefault()
    openExternalQuietly(url)
  })
}

function reportWindowState(window) {
  const report = (state) => () => window.webContents.send('window-state-change', state)
  window.on('maximize', report('maximized'))
  window.on('unmaximize', report('normal'))
  window.on('enter-full-screen', report('fullscreen'))
  window.on('leave-full-screen', report('normal'))
}

// Works out the data directory, makes sure it exists, and opens the main window.
export function createWindow({ runtimeOverrides }) {
  const config = loadConfig()
  const { dataDir, migratedPath } = resolveDataDirectory({
    config,
    runtimeOverrides,
    userDataDir: app.getPath('userData'),
    homeDir: os.homedir()
  })
  if (migratedPath) saveConfig({ ...config, dataDir: migratedPath })
  appState.dataDir = dataDir
  ensureDirSync(dataDir)
  ensureDirSync(path.join(dataDir, 'backups'))

  // Automated runs set MOTOTRACE_E2E_QUIET so the test window opens far off-screen and never
  // takes focus from whatever the developer is doing; the page itself still renders and runs.
  const quietWindow = process.env.MOTOTRACE_E2E_QUIET === '1'

  const window = new BrowserWindow({
    icon: path.join(__dirname, '../../logo.ico'),
    ...(quietWindow ? { x: -12000, y: -12000 } : {}),
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: !quietWindow
    },
    show: false
  })
  appState.mainWindow = window

  window.once('ready-to-show', () => {
    if (quietWindow) window.showInactive()
    else window.show()
  })

  if (appState.isDev) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  restrictNavigation(window)
  reportWindowState(window)
  guardClose(window)
  window.on('closed', () => {
    appState.mainWindow = null
  })
}
