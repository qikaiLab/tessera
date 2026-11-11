// The renderer is sandboxed (see src/main/window.js): this script may only use the few Electron
// modules a sandboxed preload has, so anything else goes through the main process.
const { contextBridge, ipcRenderer, webFrame } = require('electron')

const api = {
  // Window
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onStateChange: (cb) => {
      ipcRenderer.on('window-state-change', (_, state) => cb(state))
      return () => ipcRenderer.removeAllListeners('window-state-change')
    }
  },
  // Config
  config: {
    getDataDir: () => ipcRenderer.invoke('config:getDataDir'),
    planDataDirChange: (target) => ipcRenderer.invoke('config:planDataDirChange', target),
    scheduleDataDirChange: (target, copy) => ipcRenderer.invoke('config:scheduleDataDirChange', { target, copy }),
    cancelDataDirChange: () => ipcRenderer.invoke('config:cancelDataDirChange'),
    takeDataDirNotice: () => ipcRenderer.invoke('config:takeDataDirNotice'),
    get: () => ipcRenderer.invoke('config:get'),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value)
  },
  // Whole-renderer zoom. Values are normalized before reaching this bridge.
  zoom: {
    setFactor: (factor) => webFrame.setZoomFactor(factor),
    getFactor: () => webFrame.getZoomFactor()
  },
  // File System
  fs: {
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
    listDir: (dir) => ipcRenderer.invoke('fs:listDir', dir),
    exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
    scanDates: () => ipcRenderer.invoke('fs:scanDates'),
    checkTmpFiles: () => ipcRenderer.invoke('fs:checkTmpFiles'),
    recoverTmp: (tmpPath) => ipcRenderer.invoke('fs:recoverTmp', tmpPath),
    discardTmp: (tmpPath) => ipcRenderer.invoke('fs:discardTmp', tmpPath),
  },
  // Dialog
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
    openFile: (opts) => ipcRenderer.invoke('dialog:openFile', opts),
    confirm: (opts) => ipcRenderer.invoke('dialog:confirm', opts)
  },
  appearanceBackground: {
    get: () => ipcRenderer.invoke('appearanceBackground:get'),
    import: () => ipcRenderer.invoke('appearanceBackground:import'),
    clear: () => ipcRenderer.invoke('appearanceBackground:clear')
  },
  // Backup
  backup: {
    automaticList: (filePath) => ipcRenderer.invoke('backup:automaticList', filePath),
    automaticRead: (id) => ipcRenderer.invoke('backup:automaticRead', id),
    automaticRestore: (id) => ipcRenderer.invoke('backup:automaticRestore', id),
    create: () => ipcRenderer.invoke('backup:create'),
    writeZip: (path, base64Data) => ipcRenderer.invoke('backup:writeZip', path, base64Data),
    list: () => ipcRenderer.invoke('backup:list'),
    readZip: (path) => ipcRenderer.invoke('backup:readZip', path)
  },
  // Export/Import
  export: {
    writeFile: (savePath, base64Data) => ipcRenderer.invoke('export:writeFile', savePath, base64Data)
  },
  import: {
    readFile: (filePath) => ipcRenderer.invoke('import:readFile', filePath)
  },
  // Metadata
  metadata: {
    get: () => ipcRenderer.invoke('metadata:get'),
    set: (content) => ipcRenderer.invoke('metadata:set', content)
  },
  // Shell
  shell: {
    showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
    openLocalFile: (filePath) => ipcRenderer.invoke('shell:openLocalFile', filePath),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  clipboard: {
    readText: () => ipcRenderer.sendSync('clipboard:readText'),
    writeText: (text) => ipcRenderer.sendSync('clipboard:writeText', String(text ?? ''))
  },
  contextMenu: {
    show: (payload) => ipcRenderer.invoke('context-menu:show', payload),
    onCommand: (cb) => {
      const handler = (_, payload) => cb(payload)
      ipcRenderer.on('context-menu:command', handler)
      return () => ipcRenderer.removeListener('context-menu:command', handler)
    }
  },
  // Fix #8: App lifecycle — flush pending data before close
  lifecycle: {
    onBeforeClose: (cb) => {
      ipcRenderer.on('app-before-close', () => cb())
      return () => ipcRenderer.removeAllListeners('app-before-close')
    },
    confirmClose: () => ipcRenderer.invoke('app:confirmClose'),
    cancelClose: () => ipcRenderer.invoke('app:cancelClose')
  }
}

contextBridge.exposeInMainWorld('api', api)
