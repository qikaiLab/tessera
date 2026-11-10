import os from 'node:os'
import { app, dialog } from 'electron'
import { appState } from './appState.js'
import { registerAllIpc } from './ipc/index.js'
import { resolveRuntimeOverrides, shouldUseDevServer } from './runtimeOverrides.js'
import { createWindow, focusMainWindow } from './window.js'

// Automated and development runs keep their own userData/data directories; this must
// precede the single-instance lock, which is scoped to the userData directory.
const runtimeOverrides = resolveRuntimeOverrides(process.env, {
  isPackaged: app.isPackaged,
  appDataDir: app.getPath('appData'),
  homeDir: os.homedir()
})
if (runtimeOverrides) app.setPath('userData', runtimeOverrides.userDataDir)

appState.isDev = shouldUseDevServer({ isPackaged: app.isPackaged, env: process.env })

registerAllIpc()

// One instance at a time: a second launch just brings the first window forward.
if (app.requestSingleInstanceLock()) {
  app.on('second-instance', focusMainWindow)
  app.whenReady().then(() => createWindow({ runtimeOverrides })).catch((error) => {
    console.error('Startup failed:', error)
    dialog.showErrorBox('MotoTrace 无法启动', `${error.message}

没有对任何数据做改动。`)
    app.quit()
  })
} else {
  app.quit()
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
