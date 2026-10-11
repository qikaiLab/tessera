import fs from 'node:fs'
import path from 'node:path'

// config.json holds the data directory and every appearance setting. It is rewritten on
// each preference change, so a crash or power loss mid-write must never leave a truncated
// file: a half-written config would silently fall back to defaults, including pointing the
// app at an empty default data directory.

function parseConfig(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Config is not an object')
  return parsed
}

export function readConfigFile(configPath) {
  for (const candidate of [configPath, `${configPath}.bak`]) {
    try {
      if (fs.existsSync(candidate)) return parseConfig(candidate)
    } catch (error) {
      console.error(`Failed to read ${path.basename(candidate)}:`, error)
    }
  }
  return {}
}

export function writeConfigFile(configPath, config) {
  const temporaryPath = `${configPath}.tmp`
  const backupPath = `${configPath}.bak`
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), 'utf8')
  // Keep the last good file around, then swap the new one in with a rename.
  try {
    parseConfig(configPath)
    fs.copyFileSync(configPath, backupPath)
  } catch {
    // Nothing valid to back up yet.
  }
  fs.renameSync(temporaryPath, configPath)
}
