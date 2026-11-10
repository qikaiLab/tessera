import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { BrowserWindow, app, dialog } from 'electron'
import { appState, loadConfig, saveConfig } from './appState.js'
import { ensureDirSync } from './dataFiles.js'
import { resolveStartupDataDirectory } from './dataDirectoryStartup.js'
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

// The saved data folder cannot be used (an unplugged drive, a renamed or deleted folder). Nothing
// is created in its place: the user quits, or points the app at another folder.
async function askForAnotherDataFolder({ dir, problem }) {
  const detail = problem === 'missing'
    ? '这个文件夹不存在，可能是移动硬盘或网络位置没有连接，或文件夹被改名、删除。'
    : '这个位置不是可读取的文件夹。'
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: '找不到数据文件夹',
    message: `MotoTrace 的数据文件夹无法使用：
${dir}`,
    detail: `${detail}

软件不会自动新建一个空文件夹来代替，以免看起来像数据丢失。建议先退出，连接好磁盘或找回文件夹后再启动；也可以现在选择另一个已有的数据文件夹。`,
    buttons: ['退出', '选择其他文件夹…'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  if (response !== 1) return null
  const picked = await dialog.showOpenDialog({ title: '选择数据文件夹', properties: ['openDirectory'] })
  return picked.canceled ? null : { dir: picked.filePaths[0] }
}

// What happened to a requested data folder change, kept for the renderer to show once.
function rememberDataDirNotice(notice) {
  appState.dataDirNotice = notice
  if (notice) console.warn('Data directory:', JSON.stringify(notice))
}

// Works out the data directory (carrying out a requested move first), makes sure it exists, and
// opens the main window.
export async function createWindow({ runtimeOverrides }) {
  const config = loadConfig()
  const startup = await resolveStartupDataDirectory({
    config,
    runtimeOverrides,
    userDataDir: app.getPath('userData'),
    homeDir: os.homedir(),
    chooseWhenUnavailable: askForAnotherDataFolder
  })
  if (startup.abort) {
    app.quit()
    return
  }
  if (startup.configChanged) {
    saveConfig(startup.config)
    // Older versions kept the folder in this file too; keep it pointing at the folder in use.
    if (startup.config.dataDir) {
      try { fs.writeFileSync(path.join(app.getPath('userData'), 'datapath.txt'), startup.config.dataDir, 'utf8') } catch { /* optional */ }
    }
  }
  rememberDataDirNotice(startup.notice)
  const dataDir = startup.dataDir
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
