const { contextBridge, ipcRenderer } = require('electron')

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
    setDataDir: (dir) => ipcRenderer.invoke('config:setDataDir', dir),
    get: () => ipcRenderer.invoke('config:get'),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value)
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
  // Backup
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    writeZip: (path, buffer) => ipcRenderer.invoke('backup:writeZip', path, buffer),
    list: () => ipcRenderer.invoke('backup:list'),
    readZip: (path) => ipcRenderer.invoke('backup:readZip', path)
  },
  // Export/Import
  export: {
    writeFile: (savePath, buffer) => ipcRenderer.invoke('export:writeFile', savePath, buffer)
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
    showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath)
  }
}

contextBridge.exposeInMainWorld('api', api)
