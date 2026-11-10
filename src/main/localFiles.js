import fs from 'node:fs'
import path from 'node:path'

// Links in notes may point at files on this computer. Following one never runs anything: only
// plain data files (photos, text) are handed to the system's default viewer, and everything
// else is just shown in Explorer, where the user decides what to do with it.
export const OPENABLE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif', '.avif', '.tif', '.tiff',
  '.txt', '.md', '.csv', '.log'
])

const DRIVE_PATH = /^[A-Za-z]:[\\/]/
// Characters Windows does not allow in a name, plus control characters.
const FORBIDDEN_CHARS = /[<>"|?*\u0000-\u001f]/
const MAX_PATH_LENGTH = 1024

// The same link opened twice within this long (a double click) opens once.
const DUPLICATE_OPEN_WINDOW_MS = 1200
let lastOpen = { path: '', time: 0 }

/**
 * The normalized form of a local Windows path from a link, or null when it is not one we follow:
 * only absolute drive paths. Network shares (opening one sends the user's credentials to that
 * server), relative paths, `..` segments and `:` after the drive (alternate data streams) are
 * all refused.
 */
export function parseLocalFilePath(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_PATH_LENGTH) return null
  if (!DRIVE_PATH.test(input) || FORBIDDEN_CHARS.test(input)) return null
  if (input.slice(2).includes(':')) return null
  const segments = input.slice(3).split(/[\\/]+/)
  if (segments.some(segment => segment === '.' || segment === '..')) return null
  return path.win32.normalize(input)
}

/** Whether the file's own name marks it as a kind we open directly. */
export function isOpenableFile(filePath) {
  const name = path.win32.basename(filePath)
  // Windows ignores trailing dots and spaces, so "a.exe." is really a.exe.
  if (/[. ]$/.test(name)) return false
  return OPENABLE_EXTENSIONS.has(path.win32.extname(name).toLowerCase())
}

/**
 * Follows a link to a local path. Resolves to { ok: true, mode } where mode is 'opened' (handed
 * to the default app), 'folder' (a folder, opened in Explorer) or 'revealed' (shown in Explorer),
 * or { ok: false, error } with 'invalid-path', 'not-found', 'network-path' or 'open-failed'.
 */
export async function openLocalPath(rawPath, { shell, fsApi = fs, now = Date.now } = {}) {
  const target = parseLocalFilePath(rawPath)
  if (!target) return { ok: false, error: 'invalid-path' }

  let real
  let stat
  try {
    real = await fsApi.promises.realpath(target)
    stat = await fsApi.promises.stat(real)
  } catch {
    return { ok: false, error: 'not-found' }
  }
  if (real.startsWith('\\\\')) return { ok: false, error: 'network-path' }

  const time = now()
  if (lastOpen.path === real && time - lastOpen.time < DUPLICATE_OPEN_WINDOW_MS) {
    return { ok: true, mode: 'opened' }
  }
  lastOpen = { path: real, time }

  if (stat.isDirectory()) {
    return (await shell.openPath(real)) ? { ok: false, error: 'open-failed' } : { ok: true, mode: 'folder' }
  }
  // Both the name in the link and the file it resolves to (a shortcut to a program can be
  // named like a photo) must be of an openable kind.
  if (isOpenableFile(target) && isOpenableFile(real)) {
    return (await shell.openPath(real)) ? { ok: false, error: 'open-failed' } : { ok: true, mode: 'opened' }
  }
  shell.showItemInFolder(target)
  return { ok: true, mode: 'revealed' }
}

// For tests: the guard is module state.
export function resetOpenGuard() {
  lastOpen = { path: '', time: 0 }
}
