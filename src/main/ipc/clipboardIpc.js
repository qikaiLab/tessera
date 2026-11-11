import { clipboard, ipcMain } from 'electron'

// Plain-text clipboard access for the renderer. The renderer is sandboxed, and a sandboxed preload
// has no `clipboard` module of its own, so it asks here. The calls are synchronous (sendSync)
// because the context menu decides whether "paste" is enabled while it is being built.
export function registerClipboardIpc() {
  ipcMain.on('clipboard:readText', (event) => {
    event.returnValue = clipboard.readText()
  })
  ipcMain.on('clipboard:writeText', (event, text) => {
    clipboard.writeText(typeof text === 'string' ? text : String(text ?? ''))
    event.returnValue = true
  })
}
