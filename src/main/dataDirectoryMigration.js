import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

// Moving the data to another folder. Nothing here deletes or changes the folder being left: the
// data is copied, the copy is checked file by file, and only then does the app point at the new
// folder (at the next start, before anything has been opened). Any problem leaves the app on the
// old folder, with all of its data.

// Present in a target folder from the first copied byte until the copy has been verified, so an
// interrupted copy is never mistaken for a folder that holds all the data.
export const MIGRATION_MARKER = '.tessera-migration-incomplete'
const PROBE_FILE = '.tessera-write-test'
// Files a file manager adds on its own; they do not make a folder "non-empty".
const IGNORED_NAMES = new Set(['desktop.ini', 'thumbs.db', '.ds_store'])

const comparable = (value, platform) => (platform === 'win32' ? value.toLowerCase() : value)

function samePath(a, b, platform) {
  return comparable(path.resolve(a), platform) === comparable(path.resolve(b), platform)
}

// True when `child` is `parent` or inside it.
function isInside(parent, child, platform) {
  const relative = path.relative(comparable(path.resolve(parent), platform), comparable(path.resolve(child), platform))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function listEntries(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

// Every file under `dir` as { relative, size }, and every folder as a relative path (symbolic
// links are not followed or copied).
async function walkTree(dir, base = '', tree = { files: [], folders: [] }) {
  for (const entry of (await listEntries(dir)) || []) {
    const relative = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      tree.folders.push(relative)
      await walkTree(path.join(dir, entry.name), relative, tree)
    } else if (entry.isFile()) {
      tree.files.push({ relative, size: (await fs.stat(path.join(dir, entry.name))).size })
    }
  }
  return tree
}

const walkFiles = async dir => (await walkTree(dir)).files

export async function summarizeDirectory(dir) {
  const files = (await walkFiles(dir)).filter(file => file.relative !== MIGRATION_MARKER)
  return { files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0) }
}

// Does this folder look like a Tessera data folder? (days are <year>/<month>/<day>.json)
async function looksLikeData(dir) {
  const entries = (await listEntries(dir)) || []
  if (entries.some(entry => entry.isFile() && (entry.name === 'sections.json' || entry.name === 'metadata.json'))) return true
  if (entries.some(entry => entry.isDirectory() && entry.name === 'notes')) {
    const notes = (await listEntries(path.join(dir, 'notes'))) || []
    if (notes.some(entry => entry.isFile() && entry.name === 'index.json')) return true
  }
  return hasDayFile(dir, entries)
}

// Is there a day file (<year>/<month>/<day>.json) in this folder?
async function hasDayFile(dir, entries) {
  for (const year of entries.filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))) {
    const months = ((await listEntries(path.join(dir, year.name))) || []).filter(entry => entry.isDirectory() && /^\d{2}$/.test(entry.name))
    for (const month of months) {
      const days = (await listEntries(path.join(dir, year.name, month.name))) || []
      if (days.some(entry => entry.isFile() && /^\d{2}\.json$/.test(entry.name))) return true
    }
  }
  return false
}

async function canWrite(dir) {
  const probe = path.join(dir, PROBE_FILE)
  try {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(probe, 'ok')
    await fs.unlink(probe)
    return true
  } catch {
    return false
  }
}

/**
 * What would changing the data folder from `current` to `target` mean?
 *   same        the folder in use already
 *   nested      one folder lies inside the other (copying would loop, or mix two data sets)
 *   unusable    not a folder, or not writable
 *   foreign     holds other files: not a Tessera folder and not empty
 *   empty       an empty folder: the current data would be copied into it
 *   resume      a folder an earlier, unfinished copy started: copied again from the start
 *   existing    already holds Tessera data: it would be used as it is (nothing copied or merged)
 */
export async function planDataDirectoryChange({ current, target, platform = process.platform }) {
  if (!target || typeof target !== 'string' || !path.isAbsolute(target)) return { kind: 'unusable', reason: 'not-absolute' }
  if (samePath(current, target, platform)) return { kind: 'same' }
  if (isInside(current, target, platform) || isInside(target, current, platform)) return { kind: 'nested' }

  let entries
  try {
    entries = await listEntries(target)
  } catch {
    return { kind: 'unusable', reason: 'unreadable' }
  }
  if (entries !== null && !(await fs.stat(target)).isDirectory()) return { kind: 'unusable', reason: 'not-a-folder' }
  if (!(await canWrite(target))) return { kind: 'unusable', reason: 'not-writable' }

  const names = ((await listEntries(target)) || []).map(entry => entry.name).filter(name => !IGNORED_NAMES.has(name.toLowerCase()))
  if (names.length === 0) return { kind: 'empty', ...(await summarizeDirectory(current)) }
  if (names.includes(MIGRATION_MARKER)) return { kind: 'resume', ...(await summarizeDirectory(current)) }
  if (await looksLikeData(target)) return { kind: 'existing', ...(await summarizeDirectory(target)) }
  return { kind: 'foreign' }
}

function digestOf(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(file).on('data', chunk => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')))
  })
}

// Same size and same SHA-256, read back from disk (not from what was just written in memory).
async function sameContent(source, target) {
  const [a, b] = await Promise.all([fs.stat(source), fs.stat(target)])
  if (a.size !== b.size) return false
  const [left, right] = await Promise.all([digestOf(source), digestOf(target)])
  return left === right
}

/**
 * Copies every file of `source` into `target` and checks the result. Each file is written under a
 * temporary name and renamed, so a file at its final name is always whole. Throws (leaving `source`
 * untouched) when anything is missing or different afterwards; the marker then stays in `target`.
 */
export async function copyDataDirectory(source, target) {
  const tree = await walkTree(source)
  const files = tree.files.filter(file => file.relative !== MIGRATION_MARKER)
  await fs.mkdir(target, { recursive: true })
  await fs.writeFile(path.join(target, MIGRATION_MARKER), 'The copy into this folder has not finished; do not use it as a data folder.\n')

  // Empty folders are part of the layout too.
  for (const folder of tree.folders) await fs.mkdir(path.join(target, ...folder.split('/')), { recursive: true })

  for (const { relative } of files) {
    const from = path.join(source, ...relative.split('/'))
    const to = path.join(target, ...relative.split('/'))
    const partial = `${to}.migrating`
    await fs.copyFile(from, partial)
    const { mtime, atime } = await fs.stat(from)
    await fs.utimes(partial, atime, mtime)
    await fs.rename(partial, to)
  }

  for (const { relative, size } of files) {
    const from = path.join(source, ...relative.split('/'))
    const to = path.join(target, ...relative.split('/'))
    let copied
    try { copied = await fs.stat(to) } catch { throw new Error(`Copy verification failed: ${relative} is missing`) }
    if (copied.size !== size || !(await sameContent(from, to))) throw new Error(`Copy verification failed: ${relative} differs`)
  }

  await fs.unlink(path.join(target, MIGRATION_MARKER))
  return { files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0) }
}

/**
 * Carries out the change the user asked for in `config.pendingDataDirChange` ({ from, to, copy }),
 * at startup, before any data is opened. Returns null when nothing was pending, otherwise
 * { status: 'switched', from, to, copied } or { status: 'failed', from, to, error, kind }. The
 * caller saves the new config; on failure the app stays on `currentDir`.
 */
export async function applyPendingDataDirChange({ pending, currentDir, platform = process.platform }) {
  if (!pending || typeof pending !== 'object') return null
  const { to, copy } = pending
  const fail = (error, kind = 'error') => ({ status: 'failed', from: currentDir, to, error, kind })

  // The request was made for another folder than the one in use now: it is out of date.
  if (typeof pending.from !== 'string' || !samePath(pending.from, currentDir, platform)) return fail('stale', 'stale')

  const plan = await planDataDirectoryChange({ current: currentDir, target: to, platform })
  try {
    if (copy) {
      if (plan.kind !== 'empty' && plan.kind !== 'resume') return fail(`Target folder is not ready to copy into (${plan.kind})`, plan.kind)
      return { status: 'switched', from: currentDir, to, copied: await copyDataDirectory(currentDir, to) }
    }
    if (plan.kind !== 'existing') return fail(`Target folder holds no Tessera data (${plan.kind})`, plan.kind)
    return { status: 'switched', from: currentDir, to, copied: null }
  } catch (error) {
    return fail(error.message)
  }
}
