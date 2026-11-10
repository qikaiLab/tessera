import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function getDefaultDataDir(homeDir = os.homedir()) {
  return path.join(homeDir, 'MotoTrace', 'data')
}

/**
 * Where the data lives at startup.
 *
 * Automated and development runs pin their own directory (`runtimeOverrides.fixedDataDir`);
 * otherwise the directory saved in the config is used. Older versions saved it in a
 * `datapath.txt` next to the config instead: when the config has none, that file is read and
 * `migratedPath` returned so the caller can save it into the config. The default directory is
 * the last resort.
 */
export function resolveDataDirectory({ config, runtimeOverrides, userDataDir, homeDir }) {
  let dataDir = runtimeOverrides?.fixedDataDir ? runtimeOverrides.dataDir : config.dataDir
  let migratedPath = null

  if (!dataDir) {
    try {
      const legacyFile = path.join(userDataDir, 'datapath.txt')
      if (fs.existsSync(legacyFile)) {
        const customPath = fs.readFileSync(legacyFile, 'utf8').trim()
        if (customPath) {
          dataDir = customPath
          migratedPath = customPath
        }
      }
    } catch (error) {
      console.error('Failed to read datapath.txt:', error)
    }
  }

  return {
    dataDir: dataDir || runtimeOverrides?.dataDir || getDefaultDataDir(homeDir),
    migratedPath
  }
}

/**
 * Keeps `datapath.txt` (in the app's own settings folder) naming the folder in use. The uninstaller
 * cannot read config.json, so this file is how it learns where the data is; the installer writes it
 * too, and a later move in Settings must not leave it pointing at the old place. Rewritten only
 * when it differs. Returns whether anything was written.
 */
export function syncDataPathFile(userDataDir, dataDir) {
  if (!userDataDir || !dataDir) return false
  const file = path.join(userDataDir, 'datapath.txt')
  try {
    let current = null
    try {
      current = fs.readFileSync(file, 'utf8').trim()
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (current === dataDir) return false
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.writeFileSync(file, dataDir, 'utf8')
    return true
  } catch (error) {
    console.error('Failed to write datapath.txt:', error)
    return false
  }
}
