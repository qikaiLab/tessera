import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { resolveSafePath } from './security.js'

const compress = promisify(gzip)
const decompress = promisify(gunzip)
const HISTORY_PATH = 'backups/automatic'
const MAX_BYTES = 200 * 1024 * 1024
const hash = value => createHash('sha256').update(value).digest('hex')

function canonical(value, omitUpdatedAt) {
  if (Array.isArray(value)) return value.map(item => canonical(item, omitUpdatedAt))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort()
    .filter(key => !(omitUpdatedAt && key === 'updatedAt'))
    .map(key => [key, canonical(value[key], omitUpdatedAt)]))
}

function contentHash(filePath, content) {
  try {
    return hash(JSON.stringify(canonical(JSON.parse(content), filePath.startsWith('notes/'))))
  } catch {
    return hash(content)
  }
}

export function retainRevisions(revisions, now = Date.now()) {
  const groups = new Map()
  for (const entry of [...revisions].sort((a, b) => b.capturedAt - a.capturedAt)) {
    const group = groups.get(entry.path) || []
    group.push(entry)
    groups.set(entry.path, group)
  }
  const keep = new Set()
  for (const group of groups.values()) {
    group.slice(0, 20).forEach(entry => keep.add(entry.id))
    const hours = new Set()
    const days = new Set()
    for (const entry of group) {
      const age = now - entry.capturedAt
      const hour = Math.floor(entry.capturedAt / 3600000)
      const day = Math.floor(entry.capturedAt / 86400000)
      if (age <= 24 * 3600000 && !hours.has(hour)) {
        hours.add(hour)
        keep.add(entry.id)
      }
      if (age <= 30 * 86400000 && !days.has(day)) {
        days.add(day)
        keep.add(entry.id)
      }
    }
  }
  return revisions.filter(entry => keep.has(entry.id))
}

export function createAutomaticBackupStore(dataDirectory, {
  io = fs, now = Date.now, maxBytes = MAX_BYTES
} = {}) {
  const directory = path.resolve(dataDirectory)
  const historyDir = path.join(directory, HISTORY_PATH)
  const blobsDir = path.join(historyDir, 'blobs')
  let manifest = null
  let tail = Promise.resolve()
  // Serialize data and history commits, including note/index restoration.
  const queue = operation => {
    const result = tail.then(operation)
    tail = result.catch(() => {})
    return result
  }

  function sourcePath(filePath) {
    const full = resolveSafePath(directory, filePath)
    const relative = path.relative(directory, full).split(path.sep).join('/')
    if (relative === HISTORY_PATH || relative.startsWith(`${HISTORY_PATH}/`)) {
      throw new Error('Automatic history is read-only')
    }
    return { full, relative }
  }

  async function optionalRead(full) {
    try { return await io.readFile(full, 'utf8') } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  async function atomicWrite(full, content) {
    await io.mkdir(path.dirname(full), { recursive: true })
    const temporary = `${full}.tmp`
    const handle = await io.open(temporary, 'w')
    try {
      await handle.writeFile(content)
      await handle.sync()
    } finally { await handle.close() }
    await io.rename(temporary, full)
  }

  async function loadManifest() {
    if (manifest) return
    const raw = await optionalRead(path.join(historyDir, 'index.json'))
    const parsed = raw === null ? [] : JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.some(entry =>
      !entry || !/^[a-f0-9]{64}$/.test(entry.hash) || typeof entry.path !== 'string' ||
      typeof entry.id !== 'string' || !Number.isFinite(entry.capturedAt) || !Number.isFinite(entry.bytes)
    )) throw new Error('Automatic history index is invalid; original data was not changed')
    manifest = parsed
  }

  async function capture(filePath, content, reason) {
    if (content === null || !filePath.endsWith('.json') || filePath.startsWith('backups/')) return
    await loadManifest()
    const digest = contentHash(filePath, content)
    const latest = manifest.filter(entry => entry.path === filePath).at(-1)
    await io.mkdir(blobsDir, { recursive: true })
    const blobPath = path.join(blobsDir, `${digest}.gz`)
    let bytes
    let newBlob = null
    try {
      bytes = (await io.stat(blobPath)).size
      const existing = (await decompress(await io.readFile(blobPath))).toString('utf8')
      if (contentHash(filePath, existing) !== digest) throw new Error('History content failed integrity check')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      newBlob = await compress(Buffer.from(content, 'utf8'))
      bytes = newBlob.length
    }
    if (latest?.hash === digest && reason !== 'delete') return
    let title = filePath
    try { title = JSON.parse(content).title || filePath } catch { /* Preserve malformed originals too. */ }
    const entry = { id: randomUUID(), path: filePath, hash: digest, capturedAt: now(), bytes, reason, title }
    let next = retainRevisions([...manifest, entry], now())
    const totalBytes = entries => [...new Map(entries.map(item => [item.hash, item.bytes])).values()]
      .reduce((sum, size) => sum + size, 0)
    // Keep both the current and immediately preceding contents under disk pressure.
    const protectedIds = new Set()
    const protectedCounts = new Map()
    for (const item of [...next].reverse()) {
      const count = protectedCounts.get(item.path) || 0
      if (count < 2) protectedIds.add(item.id)
      protectedCounts.set(item.path, count + 1)
    }
    while (totalBytes(next) > maxBytes) {
      const removable = next.find(item => !protectedIds.has(item.id))
      if (!removable) throw new Error('Automatic history capacity reached; original data was not changed')
      next = next.filter(item => item.id !== removable.id)
    }
    if (newBlob) await atomicWrite(blobPath, newBlob)
    await atomicWrite(path.join(historyDir, 'index.json'), JSON.stringify(next))
    manifest = next
    // A cleanup failure must not invalidate a successfully committed checkpoint.
    const referenced = new Set(next.map(item => `${item.hash}.gz`))
    for (const name of await io.readdir(blobsDir)) {
      if (/^[a-f0-9]{64}\.gz$/.test(name) && !referenced.has(name)) {
        await io.unlink(path.join(blobsDir, name)).catch(error => console.warn('History cleanup failed:', error.message))
      }
    }
  }

  async function write(filePath, content) {
    if (typeof content !== 'string') throw new Error('File content must be text')
    const { full, relative } = sourcePath(filePath)
    const previous = await optionalRead(full)
    if (previous === content) return
    // Both checkpoints must be durable before replacing the original file.
    await capture(relative, previous, 'before-write')
    await capture(relative, content, 'save')
    await atomicWrite(full, content)
  }

  async function remove(filePath) {
    const { full, relative } = sourcePath(filePath)
    const previous = await optionalRead(full)
    if (previous === null) return
    await capture(relative, previous, 'delete')
    const noteMatch = /^notes\/(?!index\.json$)([^/]+)\.json$/.exec(relative)
    const indexPath = path.join(directory, 'notes/index.json')
    const previousIndex = noteMatch ? await optionalRead(indexPath) : null
    if (previousIndex !== null) {
      const index = JSON.parse(previousIndex)
      if (!Array.isArray(index)) throw new Error('Notes index is invalid')
      const nextIndex = JSON.stringify(index.filter(item => item.id !== noteMatch[1]), null, 2)
      await capture('notes/index.json', previousIndex, 'before-write')
      await capture('notes/index.json', nextIndex, 'save')
      await atomicWrite(indexPath, nextIndex)
    }
    try { await io.unlink(full) } catch (error) {
      if (previousIndex !== null) await atomicWrite(indexPath, previousIndex)
      throw error
    }
  }

  async function readRevision(id) {
    await loadManifest()
    const entry = manifest.find(item => item.id === id)
    if (!entry) throw new Error('History revision not found')
    const content = (await decompress(await io.readFile(path.join(blobsDir, `${entry.hash}.gz`)))).toString('utf8')
    if (contentHash(entry.path, content) !== entry.hash) throw new Error('History content failed integrity check')
    sourcePath(entry.path)
    return { ...entry, content }
  }

  return {
    write: (filePath, content) => queue(() => write(filePath, content)),
    delete: filePath => queue(() => remove(filePath)),
    list: filePath => queue(async () => {
      await loadManifest()
      const relative = filePath ? sourcePath(filePath).relative : null
      return [...manifest].filter(entry => !relative || entry.path === relative).reverse()
    }),
    read: id => queue(() => readRevision(id)),
    restore: id => queue(async () => {
      const entry = await readRevision(id)
      if (/^notes\/(?!index\.json$)[^/]+\.json$/.test(entry.path)) {
        const original = JSON.parse(entry.content)
        if (!original || !original.content || original.content.type !== 'doc') throw new Error('This revision is not a valid note')
        const noteId = randomUUID()
        const timestamp = new Date(now()).toISOString()
        const note = { ...original, id: noteId, title: `${original.title || '无标题便签'}（恢复副本）`, createdAt: timestamp, updatedAt: timestamp, archived: false }
        const rawIndex = await optionalRead(path.join(directory, 'notes/index.json'))
        const index = rawIndex === null ? [] : JSON.parse(rawIndex)
        if (!Array.isArray(index)) throw new Error('Notes index is invalid')
        const { content: _content, ...meta } = note
        await write(`notes/${noteId}.json`, JSON.stringify(note, null, 2))
        await write('notes/index.json', JSON.stringify([meta, ...index], null, 2))
        return { path: `notes/${noteId}.json`, copied: true }
      }
      if (entry.path === 'notes/index.json') throw new Error('Restore individual notes instead of replacing the notes index')
      JSON.parse(entry.content)
      await write(entry.path, entry.content)
      return { path: entry.path, copied: false }
    })
  }
}
