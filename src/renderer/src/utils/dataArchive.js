import JSZip from 'jszip'

// Backups and exports are ZIP files of the data directory's JSON files, passed between the
// main and renderer processes as base64.

// What an import is willing to read. A ZIP is attacker-shaped input (a "backup" downloaded from
// somewhere, a damaged file): a few hundred kilobytes can inflate to gigabytes, and a small file can
// hold millions of entries. Real data is far below these numbers (three years of daily records are a
// few megabytes), so a file over them is refused before it can exhaust the memory of the app.
const MIB = 1024 * 1024
export const ARCHIVE_LIMITS = Object.freeze({
  maxFileBytes: 128 * MIB, // the ZIP file itself
  maxEntries: 50_000, // files and folders in it
  maxEntryBytes: 32 * MIB, // one JSON file, once inflated
  maxTotalBytes: 256 * MIB // all JSON files together, once inflated
})

export class ArchiveLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ArchiveLimitError'
  }
}

const formatMiB = bytes => `${Math.round(bytes / MIB)} MB`

export async function zipFilesToBase64(files) {
  const zip = new JSZip()
  files.forEach(file => zip.file(file.path, file.content))
  return zip.generateAsync({ type: 'base64' })
}

// Is this entry inside the app's own backups folder? Windows treats "Backups", "BACKUPS/" and
// "backups./" as that same folder, so a case-sensitive test would let such an entry through to the
// automatic history it must never touch.
export function isBackupsFolderEntry(path) {
  const first = path.split(/[\\/]+/).filter(segment => segment && segment !== '.')[0] || ''
  return first.replace(/[. ]+$/, '').toLowerCase() === 'backups'
}

// The size of the file behind a base64 string, without decoding it.
function base64ByteLength(base64Data) {
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
  return Math.floor(base64Data.length * 3 / 4) - padding
}

// The number of entries the ZIP says it has, read from its end-of-central-directory record, so a file
// claiming millions of entries is refused before JSZip builds an object for each of them. Returns
// null when the record cannot be found (JSZip then reports the file as damaged).
function declaredEntryCount(base64Data) {
  // The record is 22 bytes plus a comment of up to 65535 bytes, at the very end of the file.
  const tailChars = Math.min(base64Data.length, Math.ceil((22 + 65535) / 3) * 4 + 4)
  const start = base64Data.length - tailChars - ((base64Data.length - tailChars) % 4)
  let tail
  try {
    tail = atob(base64Data.slice(Math.max(0, start)))
  } catch {
    return null
  }
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (tail.charCodeAt(index) === 0x50 && tail.charCodeAt(index + 1) === 0x4b &&
        tail.charCodeAt(index + 2) === 0x05 && tail.charCodeAt(index + 3) === 0x06) {
      const total = tail.charCodeAt(index + 10) | (tail.charCodeAt(index + 11) << 8)
      // 0xFFFF means "see the zip64 record": more entries than this app ever writes.
      return total === 0xFFFF ? Infinity : total
    }
  }
  return null
}

// Inflates one entry, giving up as soon as it has produced more than `maxBytes` rather than after
// the whole thing sits in memory.
function inflateEntry(file, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    const stream = file.internalStream('uint8array')
    stream.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        stream.pause()
        reject(Object.assign(new Error('entry too large'), { exceeded: true }))
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', reject)
    stream.on('end', () => resolve({ bytes: chunks, size }))
    stream.resume()
  })
}

const decodeUtf8 = (chunks, size) => {
  const joined = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.length
  }
  return new TextDecoder('utf-8').decode(joined)
}

// The JSON files an import should restore: everything except the app's own backup folder.
export async function readArchiveJsonEntries(base64Data, limits = ARCHIVE_LIMITS) {
  if (base64ByteLength(base64Data) > limits.maxFileBytes) {
    throw new ArchiveLimitError(`压缩包超过 ${formatMiB(limits.maxFileBytes)}，已拒绝导入`)
  }
  const declared = declaredEntryCount(base64Data)
  if (declared !== null && declared > limits.maxEntries) {
    throw new ArchiveLimitError(`压缩包里的文件超过 ${limits.maxEntries} 个，已拒绝导入`)
  }
  const zip = await JSZip.loadAsync(base64Data, { base64: true })
  const names = Object.keys(zip.files)
  if (names.length > limits.maxEntries) {
    throw new ArchiveLimitError(`压缩包里的文件超过 ${limits.maxEntries} 个，已拒绝导入`)
  }
  const entries = []
  let total = 0
  for (const path of names) {
    const file = zip.files[path]
    if (file.dir || !path.endsWith('.json') || isBackupsFolderEntry(path)) continue
    const remaining = limits.maxTotalBytes - total
    let inflated
    try {
      inflated = await inflateEntry(file, Math.min(limits.maxEntryBytes, remaining))
    } catch (error) {
      if (!error?.exceeded) throw error
      throw new ArchiveLimitError(limits.maxEntryBytes <= remaining
        ? `压缩包里有文件展开后超过 ${formatMiB(limits.maxEntryBytes)}（${path}），已拒绝导入`
        : `压缩包里的文件展开后合计超过 ${formatMiB(limits.maxTotalBytes)}，已拒绝导入`)
    }
    const { bytes, size } = inflated
    total += size
    entries.push({ path, text: decodeUtf8(bytes, size) })
  }
  return entries
}

// A path segment that goes up a folder, or that Windows would read as something other than the
// plain file name it looks like: a device (CON, NUL, COM1 ... with or without an extension), an
// alternate data stream or drive (a colon), characters it does not allow, or a name ending in a dot
// or space. The file layer refuses the same names (src/main/security.js).
const DEVICE_NAME = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i
function isUnsafeSegment(segment) {
  return segment === '..' || /[<>:"|?*\u0000-\u001f]/.test(segment) || DEVICE_NAME.test(segment) || (segment !== '.' && /[. ]$/.test(segment))
}

/**
 * The entries of an archive that must not be imported: a path that could leave the data
 * directory, or JSON that does not parse. An import writes over existing files, so it checks
 * every entry first and writes nothing at all when one is bad.
 */
export function findInvalidArchiveEntries(entries) {
  const invalid = []
  for (const { path, text } of entries) {
    const unsafePath = /^([a-zA-Z]:|[\\/])/.test(path) || path.split(/[\\/]/).some(isUnsafeSegment)
    let parsable = true
    try { JSON.parse(text) } catch { parsable = false }
    if (unsafePath || !parsable) invalid.push({ path, reason: unsafePath ? 'path' : 'json' })
  }
  return invalid
}
