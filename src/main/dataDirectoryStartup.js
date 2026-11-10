import fs from 'node:fs'
import { applyPendingDataDirChange } from './dataDirectoryMigration.js'
import { getDefaultDataDir, resolveDataDirectory } from './dataDirectory.js'

// Which data folder this run opens, decided before anything is read or written. Two things can
// happen here besides "use the saved folder":
//   - the user asked (in Settings) to move the data: it is copied and verified now, and only a
//     verified copy becomes the new folder;
//   - the saved folder is gone (an unplugged drive, a renamed or deleted folder): it is never
//     quietly recreated as an empty folder, because that would look like all the data vanished.

const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)

export function inspectFolder(dir, io = fs) {
  try {
    return io.statSync(dir).isDirectory() ? 'ok' : 'not-a-folder'
  } catch (error) {
    return error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'missing' : 'unreadable'
  }
}

// A pending request is data from the config file: only a well-formed one is acted on.
export function readPendingChange(config) {
  const pending = config?.pendingDataDirChange
  if (!pending || typeof pending !== 'object') return null
  if (typeof pending.from !== 'string' || typeof pending.to !== 'string') return null
  return { from: pending.from, to: pending.to, copy: pending.copy === true }
}

/**
 * @param chooseWhenUnavailable async ({ dir, problem }) => { dir } | null, asked when the saved
 *   folder cannot be used; null (or a thrown error) means "quit, change nothing".
 * @returns {{ dataDir, config, configChanged, notice, abort }} `config` is what to save when
 *   `configChanged`; `notice` ({ kind, from, to, error? }) is shown to the user once.
 */
export async function resolveStartupDataDirectory({
  config, runtimeOverrides, userDataDir, homeDir, chooseWhenUnavailable, io = fs
}) {
  const resolved = resolveDataDirectory({ config, runtimeOverrides, userDataDir, homeDir })
  let dataDir = resolved.dataDir
  let nextConfig = { ...config }
  let configChanged = false
  let notice = null

  if (resolved.migratedPath) {
    nextConfig.dataDir = resolved.migratedPath
    configChanged = true
  }

  // Automated runs pin their folder and are never redirected or asked anything.
  if (runtimeOverrides?.fixedDataDir) {
    return { dataDir, config: config, configChanged: false, notice: null, abort: false }
  }

  const pending = readPendingChange(config)
  if (config.pendingDataDirChange !== undefined) {
    delete nextConfig.pendingDataDirChange
    configChanged = true
  }
  // The folder being left must exist for a request to make sense; otherwise the guard below
  // handles it.
  if (pending && inspectFolder(dataDir, io) === 'ok') {
    const result = await applyPendingDataDirChange({ pending, currentDir: dataDir })
    if (result.status === 'switched') {
      dataDir = result.to
      nextConfig.dataDir = result.to
      notice = { kind: 'switched', from: result.from, to: result.to, copied: result.copied }
    } else {
      notice = { kind: 'failed', from: result.from, to: result.to, error: result.error, reason: result.kind }
    }
  } else if (pending) {
    notice = { kind: 'failed', from: pending.from, to: pending.to, error: 'current folder unavailable', reason: 'stale' }
  }

  // The folder in use: the default one is created on first launch; any folder the user chose
  // must already exist.
  const customised = Boolean(nextConfig.dataDir) && !samePath(nextConfig.dataDir, getDefaultDataDir(homeDir))
  const problem = inspectFolder(dataDir, io)
  if (problem !== 'ok' && (customised || problem !== 'missing')) {
    let choice = null
    try { choice = await chooseWhenUnavailable?.({ dir: dataDir, problem }) } catch { choice = null }
    if (!choice?.dir || inspectFolder(choice.dir, io) !== 'ok') {
      return { dataDir, config, configChanged: false, notice, abort: true }
    }
    dataDir = choice.dir
    nextConfig.dataDir = choice.dir
    configChanged = true
    notice = { kind: 'relocated', from: resolved.dataDir, to: choice.dir }
  }

  return { dataDir, config: nextConfig, configChanged, notice, abort: false }
}
