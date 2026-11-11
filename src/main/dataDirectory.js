import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function getDefaultDataDir(homeDir = os.homedir()) {
  return path.join(homeDir, 'MotoTrace', 'data')
}

/**
 * Reads `datapath.txt`. Two encodings occur: plain UTF-8 (what older versions wrote; identical to
 * ANSI for a path of ASCII characters) and UTF-16 LE with a byte order mark, which the installer
 * writes and the uninstaller reads, because that is the only form NSIS can read and write without
 * losing the characters of a folder such as `D:\日记`. Returns { text, utf16 }.
 */
export function readDataPathFile(file) {
  const bytes = fs.readFileSync(file)
  const utf16 = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe
  const text = utf16 ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8').replace(/^\uFEFF/, '')
  return { text: text.trim(), utf16 }
}

const UTF16_LE_BOM = Buffer.from([0xff, 0xfe])
const isAscii = text => /^[\x00-\x7f]*$/.test(text)

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
        const customPath = readDataPathFile(legacyFile).text
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
 * when it differs. A path with non-ASCII characters is written as UTF-16 LE with a byte order mark
 * (the form the uninstaller can read, see `readDataPathFile`), any other as plain UTF-8, which is
 * what every version has always written for it. Returns whether anything was written.
 */
export function syncDataPathFile(userDataDir, dataDir) {
  if (!userDataDir || !dataDir) return false
  const file = path.join(userDataDir, 'datapath.txt')
  try {
    let current = null
    try {
      current = readDataPathFile(file)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const ascii = isAscii(dataDir)
    // Already naming this folder, in a form the uninstaller reads correctly.
    if (current && current.text === dataDir && (ascii || current.utf16)) return false
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.writeFileSync(file, ascii ? Buffer.from(dataDir, 'utf8') : Buffer.concat([UTF16_LE_BOM, Buffer.from(dataDir, 'utf16le')]))
    return true
  } catch (error) {
    console.error('Failed to write datapath.txt:', error)
    return false
  }
}
