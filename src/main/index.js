const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { fileURLToPath } = require('url')

// Platform path helpers
const isDev = !app.isPackaged

let mainWindow
let dataDir = ''

function getDefaultDataDir() {
  return path.join(os.homedir(), 'MotoTrace', 'data')
}

function loadConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      return cfg
    }
  } catch {}
  return {}
}

function saveConfig(cfg) {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8')
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function createWindow() {
  const cfg = loadConfig()
  dataDir = cfg.dataDir || getDefaultDataDir()
  ensureDir(dataDir)
  ensureDir(path.join(dataDir, 'backups'))

  mainWindow = new BrowserWindow({
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
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-state-change', 'maximized'))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state-change', 'normal'))
  mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('window-state-change', 'fullscreen'))
  mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('window-state-change', 'normal'))
}

app.whenReady().then(createWindow)

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

// Config
ipcMain.handle('config:getDataDir', () => dataDir)
ipcMain.handle('config:setDataDir', (_, newDir) => {
  ensureDir(newDir)
  dataDir = newDir
  const cfg = loadConfig()
  cfg.dataDir = newDir
  saveConfig(cfg)
  return true
})
ipcMain.handle('config:get', () => loadConfig())
ipcMain.handle('config:set', (_, key, value) => {
  const cfg = loadConfig()
  cfg[key] = value
  saveConfig(cfg)
  return true
})

// File System
ipcMain.handle('fs:readFile', (_, filePath) => {
  const full = path.isAbsolute(filePath) ? filePath : path.join(dataDir, filePath)
  try {
    return { ok: true, data: fs.readFileSync(full, 'utf8') }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:writeFile', (_, filePath, content) => {
  const full = path.isAbsolute(filePath) ? filePath : path.join(dataDir, filePath)
  try {
    ensureDir(path.dirname(full))
    // Write to .tmp first, then rename for crash safety
    const tmp = full + '.tmp'
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, full)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:deleteFile', (_, filePath) => {
  const full = path.isAbsolute(filePath) ? filePath : path.join(dataDir, filePath)
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:listDir', (_, dir) => {
  const full = path.isAbsolute(dir) ? dir : path.join(dataDir, dir)
  try {
    if (!fs.existsSync(full)) return { ok: true, data: [] }
    return { ok: true, data: fs.readdirSync(full) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:exists', (_, filePath) => {
  const full = path.isAbsolute(filePath) ? filePath : path.join(dataDir, filePath)
  return fs.existsSync(full)
})

ipcMain.handle('fs:scanDates', () => {
  // Scan all YYYY/MM/DD.json recursively to build date index
  const dates = []
  try {
    const yearDirs = fs.readdirSync(dataDir).filter(d => /^\d{4}$/.test(d))
    for (const year of yearDirs) {
      const yearPath = path.join(dataDir, year)
      const monthDirs = fs.readdirSync(yearPath).filter(d => /^\d{2}$/.test(d))
      for (const month of monthDirs) {
        const monthPath = path.join(yearPath, month)
        const dayFiles = fs.readdirSync(monthPath).filter(f => /^\d{2}\.json$/.test(f))
        for (const dayFile of dayFiles) {
          const day = dayFile.replace('.json', '')
          dates.push(`${year}-${month}-${day}`)
        }
      }
    }
  } catch {}
  return dates
})

ipcMain.handle('fs:checkTmpFiles', () => {
  // Find any .tmp files left over from crashes
  const tmpFiles = []
  function scan(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) scan(full)
        else if (e.name.endsWith('.tmp')) tmpFiles.push(full)
      }
    } catch {}
  }
  scan(dataDir)
  return tmpFiles
})

ipcMain.handle('fs:recoverTmp', (_, tmpPath) => {
  try {
    const target = tmpPath.replace(/\.tmp$/, '')
    fs.renameSync(tmpPath, target)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:discardTmp', (_, tmpPath) => {
  try {
    fs.unlinkSync(tmpPath)
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

// Backup
ipcMain.handle('backup:create', async () => {
  try {
    const backupDir = path.join(dataDir, 'backups')
    ensureDir(backupDir)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupPath = path.join(backupDir, `backup-${timestamp}.zip`)

    // Simple backup: copy all JSON files to a zip using JSZip in main
    // We'll pass the data back to renderer to do the zip
    const files = []
    function collectFiles(dir, base = '') {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          const rel = base ? `${base}/${e.name}` : e.name
          if (e.isDirectory() && e.name !== 'backups') collectFiles(full, rel)
          else if (e.name.endsWith('.json') && !base.startsWith('backups')) {
            files.push({ path: rel, content: fs.readFileSync(full, 'utf8') })
          }
        }
      } catch {}
    }
    collectFiles(dataDir)
    return { ok: true, files, backupPath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('backup:writeZip', (_, backupPath, buffer) => {
  try {
    fs.writeFileSync(backupPath, Buffer.from(buffer))
    // Enforce max 30 backups
    const backupDir = path.dirname(backupPath)
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
      .sort()
    if (backups.length > 30) {
      const toDelete = backups.slice(0, backups.length - 30)
      for (const b of toDelete) {
        fs.unlinkSync(path.join(backupDir, b))
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('backup:list', () => {
  const backupDir = path.join(dataDir, 'backups')
  try {
    if (!fs.existsSync(backupDir)) return []
    return fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.zip'))
      .sort()
      .reverse()
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        size: fs.statSync(path.join(backupDir, f)).size,
        date: fs.statSync(path.join(backupDir, f)).mtime.toISOString()
      }))
  } catch {
    return []
  }
})

ipcMain.handle('backup:readZip', (_, backupPath) => {
  try {
    const buffer = fs.readFileSync(backupPath)
    return { ok: true, buffer: Array.from(buffer) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('export:writeFile', (_, savePath, buffer) => {
  try {
    fs.writeFileSync(savePath, Buffer.from(buffer))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('import:readFile', (_, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return { ok: true, buffer: Array.from(buffer) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('shell:showItemInFolder', (_, filePath) => {
  shell.showItemInFolder(filePath)
})
