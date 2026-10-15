import { registerAppearanceIpc } from './appearanceIpc.js'
import { registerBackupIpc } from './backupIpc.js'
import { registerConfigIpc } from './configIpc.js'
import { registerDialogIpc } from './dialogIpc.js'
import { registerFileIpc } from './fileIpc.js'
import { registerMetadataIpc } from './metadataIpc.js'
import { registerWindowIpc } from './windowIpc.js'

// Every channel the renderer can call (see src/preload/index.js for the names it sees).
export function registerAllIpc() {
  registerWindowIpc()
  registerConfigIpc()
  registerFileIpc()
  registerDialogIpc()
  registerAppearanceIpc()
  registerBackupIpc()
  registerMetadataIpc()
}
