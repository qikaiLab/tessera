const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = require('fs').promises
const os = require('os')
import {
  resolveSafePath,
  isAllowedExternalUrl,
  isAppNavigationUrl as isAllowedAppNavigation
} from './security.js'
import {
  importBackgroundImage,
  readManagedBackground,
  removeManagedBackgrounds
} from './appearanceBackground.js'

// Platform path helpers
const isDev = !app.isPackaged

let mainWindow
let dataDir = ''
let isQuitting = false
let lastExternalOpen = { url: '', time: 0 }

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

function getDefaultDataDir() {
  return path.join(os.homedir(), 'MotoTrace', 'data')
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }

  mainWindow.focus()
}

function buildContextMenuTemplate(items, context, sender) {
  if (!Array.isArray(items)) return []

  return items
    .filter(item => item && item.visible !== false)
    .map(item => {
      if (item.type === 'separator') return { type: 'separator' }

      const menuItem = {
        label: String(item.label || ''),
        enabled: item.enabled !== false
      }

      if (item.role) {
        menuItem.role = item.role
      } else if (item.id) {
        menuItem.click = () => {
          sender.send('context-menu:command', {
            id: item.id,
            context: context || {}
          })
        }
      }

      return menuItem
    })
}

// ─── Path Safety (#5) ─────────────────────────────────────────────────────────
// Prevent path traversal attacks by ensuring resolved paths stay within dataDir

function safePath(filePath) {
  return resolveSafePath(dataDir, filePath)
}

// ─── Config (uses app userData, not dataDir — no safePath needed) ──────────────

function loadConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      return cfg
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  }
  return {}
}

function saveConfig(cfg) {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8')
}

// ─── Async helpers ────────────────────────────────────────────────────────────

async function ensureDir(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true })
  } catch (e) {
    // EEXIST is fine
    if (e.code !== 'EEXIST') throw e
  }
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function isAppNavigationUrl(url) {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'
  return isAllowedAppNavigation(url, { isDev, rendererUrl })
}

async function openExternalUrl(url) {
  if (!isAllowedExternalUrl(url)) {
    throw new Error('Unsupported external link protocol')
  }
  const normalizedUrl = new URL(url).toString()
  const now = Date.now()
  if (lastExternalOpen.url === normalizedUrl && now - lastExternalOpen.time < 1200) {
    return
  }
  lastExternalOpen = { url: normalizedUrl, time: now }
  await shell.openExternal(normalizedUrl)
}

function createWindow() {
  const cfg = loadConfig()
  
  let initialDataDir = cfg.dataDir
  if (!initialDataDir) {
    try {
      const datapathFile = path.join(app.getPath('userData'), 'datapath.txt')
      if (fs.existsSync(datapathFile)) {
        const customPath = fs.readFileSync(datapathFile, 'utf8').trim()
        if (customPath) {
          initialDataDir = customPath
          cfg.dataDir = customPath
          saveConfig(cfg)
        }
      }
    } catch (e) {
      console.error('Failed to read datapath.txt:', e)
    }
  }

  dataDir = initialDataDir || getDefaultDataDir()
  ensureDirSync(dataDir)
  ensureDirSync(path.join(dataDir, 'backups'))

  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, '../../logo.ico'),
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
      sandbox: false
    },
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      openExternalUrl(url).catch(e => console.error('Failed to open external URL:', e))
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppNavigationUrl(url)) return
    event.preventDefault()
    if (isAllowedExternalUrl(url)) {
      openExternalUrl(url).catch(e => console.error('Failed to open external URL:', e))
    }
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-state-change', 'maximized'))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state-change', 'normal'))
  mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('window-state-change', 'fullscreen'))
  mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('window-state-change', 'normal'))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // ─── Fix #8: Graceful close — flush pending data before quitting ────────────
  mainWindow.on('close', (e) => {
    if (isQuitting) return // Already confirmed, let it close

    e.preventDefault()
    // Ask renderer to flush pending saves
    mainWindow.webContents.send('app-before-close')

    // Safety timeout: if renderer doesn't respond within 3s, force close
    setTimeout(() => {
      isQuitting = true
      mainWindow.close()
    }, 3000)
  })
}

// Fix #8: Renderer confirms it's safe to close
ipcMain.handle('app:confirmClose', () => {
  isQuitting = true
  mainWindow?.close()
})

if (gotSingleInstanceLock) {
  app.on('second-instance', focusMainWindow)
  app.whenReady().then(createWindow)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Window controls
ipcMain.handle('window:minimize', () => mainWindow.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.handle('window:close', () => mainWindow.close())
ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized())

ipcMain.handle('context-menu:show', (event, { items, context, x, y } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return false

  const template = buildContextMenuTemplate(items, context, event.sender)
  if (!template.length) return false

  const menu = Menu.buildFromTemplate(template)
  const popupOptions = { window: win }
  if (Number.isFinite(x) && Number.isFinite(y)) {
    popupOptions.x = Math.round(x)
    popupOptions.y = Math.round(y)
  }
  menu.popup(popupOptions)
  return true
})

// Config
ipcMain.handle('config:getDataDir', () => dataDir)
ipcMain.handle('config:setDataDir', async (_, newDir) => {
  await ensureDir(newDir)
  dataDir = newDir
  const cfg = loadConfig()
  cfg.dataDir = newDir
  saveConfig(cfg)
  try {
    const datapathFile = path.join(app.getPath('userData'), 'datapath.txt')
    await fsp.writeFile(datapathFile, newDir, 'utf8')
  } catch (e) {
    console.error('Failed to write datapath.txt:', e)
  }
  return true
})
ipcMain.handle('config:get', () => loadConfig())
ipcMain.handle('config:set', (_, key, value) => {
  const cfg = loadConfig()
  cfg[key] = value
  saveConfig(cfg)
  return true
})

// ─── File System (all async, with path safety) ───────────────────────────────

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    const full = safePath(filePath)
    const data = await fsp.readFile(full, 'utf8')
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  try {
    const full = safePath(filePath)
    await ensureDir(path.dirname(full))
    // Write to .tmp first, then rename for crash safety
    const tmp = full + '.tmp'
    await fsp.writeFile(tmp, content, 'utf8')
    await fsp.rename(tmp, full)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:deleteFile', async (_, filePath) => {
  try {
    const full = safePath(filePath)
    try {
      await fsp.unlink(full)
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:listDir', async (_, dir) => {
  try {
    const full = safePath(dir)
    try {
      const entries = await fsp.readdir(full)
      return { ok: true, data: entries }
    } catch (e) {
      if (e.code === 'ENOENT') return { ok: true, data: [] }
      throw e
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:exists', async (_, filePath) => {
  try {
    const full = safePath(filePath)
    try {
      await fsp.access(full)
      return true
    } catch {
      return false
    }
  } catch {
    return false
  }
})

ipcMain.handle('fs:scanDates', async () => {
  // Scan all YYYY/MM/DD.json recursively to build date index
  const dates = []
  try {
    const entries = await fsp.readdir(dataDir)
    const yearDirs = entries.filter(d => /^\d{4}$/.test(d))
    for (const year of yearDirs) {
      const yearPath = path.join(dataDir, year)
      try {
        const monthEntries = await fsp.readdir(yearPath)
        const monthDirs = monthEntries.filter(d => /^\d{2}$/.test(d))
        for (const month of monthDirs) {
          const monthPath = path.join(yearPath, month)
          try {
            const dayEntries = await fsp.readdir(monthPath)
            const dayFiles = dayEntries.filter(f => /^\d{2}\.json$/.test(f))
            for (const dayFile of dayFiles) {
              const day = dayFile.replace('.json', '')
              dates.push(`${year}-${month}-${day}`)
            }
          } catch (e) {
            console.error(`Failed to read month dir ${monthPath}:`, e)
          }
        }
      } catch (e) {
        console.error(`Failed to read year dir ${yearPath}:`, e)
      }
    }
  } catch (e) {
    console.error('Failed to scan dates:', e)
  }
  return dates
})

ipcMain.handle('fs:checkTmpFiles', async () => {
  // Find any .tmp files left over from crashes
  const tmpFiles = []
  async function scan(dir) {
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) await scan(full)
        else if (e.name.endsWith('.tmp')) tmpFiles.push(full)
      }
    } catch (e) {
      console.error(`Failed to scan for tmp files in ${dir}:`, e)
    }
  }
  await scan(dataDir)
  return tmpFiles
})

ipcMain.handle('fs:recoverTmp', async (_, tmpPath) => {
  try {
    // Validate that tmpPath is within dataDir
    const normalizedDataDir = path.resolve(dataDir)
    const resolvedTmp = path.resolve(tmpPath)
    if (!resolvedTmp.startsWith(normalizedDataDir + path.sep)) {
      throw new Error('Path traversal detected')
    }
    const target = tmpPath.replace(/\.tmp$/, '')
    await fsp.rename(tmpPath, target)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:discardTmp', async (_, tmpPath) => {
  try {
    // Validate that tmpPath is within dataDir
    const normalizedDataDir = path.resolve(dataDir)
    const resolvedTmp = path.resolve(tmpPath)
    if (!resolvedTmp.startsWith(normalizedDataDir + path.sep)) {
      throw new Error('Path traversal detected')
    }
    await fsp.unlink(tmpPath)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_, opts) => {
  const result = await dialog.showSaveDialog(mainWindow, opts)
  return result.canceled ? null : result.filePath
})

ipcMain.handle('dialog:openFile', async (_, opts) => {
  const result = await dialog.showOpenDialog(mainWindow, opts)
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:confirm', async (_, { message, buttons = ['确定', '取消'], title = '提示' }) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons,
    defaultId: 0,
    cancelId: 1,
    title,
    message,
    noLink: true
  })
  return response === 0
})

// Keep imported appearance assets in app-owned storage so moving the source
// file cannot break a persisted background.
ipcMain.handle('appearanceBackground:get', async () => {
  try {
    const background = await readManagedBackground(app.getPath('userData'))
    return { ok: true, background }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('appearanceBackground:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择雾化玻璃背景图',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  })
  if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true }

  try {
    const background = await importBackgroundImage(result.filePaths[0], app.getPath('userData'))
    return { ok: true, canceled: false, background }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('appearanceBackground:clear', async () => {
  try {
    await removeManagedBackgrounds(app.getPath('userData'))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

// Backup
ipcMain.handle('backup:create', async () => {
  try {
    const backupDir = path.join(dataDir, 'backups')
    await ensureDir(backupDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupPath = path.join(backupDir, `backup-${timestamp}.zip`)

    // Collect all JSON files
    const files = []
    async function collectFiles(dir, base = '') {
      try {
        const entries = await fsp.readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          const rel = base ? `${base}/${e.name}` : e.name
          if (e.isDirectory() && e.name !== 'backups') await collectFiles(full, rel)
          else if (e.name.endsWith('.json') && !base.startsWith('backups')) {
            const content = await fsp.readFile(full, 'utf8')
            files.push({ path: rel, content })
          }
        }
      } catch (e) {
        console.error(`Failed to collect files from ${dir}:`, e)
      }
    }
    await collectFiles(dataDir)
    return { ok: true, files, backupPath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Fix #4: Use base64 instead of Array.from(buffer) for IPC transfers
ipcMain.handle('backup:writeZip', async (_, backupPath, base64Data) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64')
    await fsp.writeFile(backupPath, buffer)
    // Enforce max 30 backups
    const backupDir = path.dirname(backupPath)
    const allFiles = await fsp.readdir(backupDir)
    const backups = allFiles
      .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
      .sort()
    if (backups.length > 30) {
      const toDelete = backups.slice(0, backups.length - 30)
      for (const b of toDelete) {
        await fsp.unlink(path.join(backupDir, b))
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('backup:list', async () => {
  const backupDir = path.join(dataDir, 'backups')
  try {
    try {
      await fsp.access(backupDir)
    } catch {
      return []
    }
    const allFiles = await fsp.readdir(backupDir)
    const zipFiles = allFiles.filter(f => f.endsWith('.zip')).sort().reverse()
    const result = []
    for (const f of zipFiles) {
      const filePath = path.join(backupDir, f)
      const stat = await fsp.stat(filePath)
      result.push({
        name: f,
        path: filePath,
        size: stat.size,
        date: stat.mtime.toISOString()
      })
    }
    return result
  } catch (e) {
    console.error('Failed to list backups:', e)
    return []
  }
})

// Fix #4: Use base64 instead of Array.from(buffer)
ipcMain.handle('backup:readZip', async (_, backupPath) => {
  try {
    const buffer = await fsp.readFile(backupPath)
    return { ok: true, data: buffer.toString('base64') }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Fix #4 + #5: export/import use dialog-chosen paths (trusted), but still use base64
ipcMain.handle('export:writeFile', async (_, savePath, base64Data) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64')
    await fsp.writeFile(savePath, buffer)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('import:readFile', async (_, filePath) => {
  try {
    const buffer = await fsp.readFile(filePath)
    return { ok: true, data: buffer.toString('base64') }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('metadata:get', async () => {
  const metaPath = path.join(dataDir, 'metadata.json')
  try {
    try {
      const data = await fsp.readFile(metaPath, 'utf8')
      return { ok: true, data }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return { ok: true, data: JSON.stringify({ countdowns: [], analytics: [] }) }
      }
      throw e
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('metadata:set', async (_, content) => {
  const metaPath = path.join(dataDir, 'metadata.json')
  try {
    await ensureDir(path.dirname(metaPath))
    const tmp = metaPath + '.tmp'
    await fsp.writeFile(tmp, content, 'utf8')
    await fsp.rename(tmp, metaPath)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('shell:showItemInFolder', (_, filePath) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('shell:openExternal', async (_, url) => {
  try {
    await openExternalUrl(url)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})
