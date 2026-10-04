import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { createAutomaticBackupStore, retainRevisions } from '../src/main/automaticBackup.js'

const directories = []
const note = (text, updatedAt = '2026-01-01') => JSON.stringify({ id: 'plans', title: 'Plans', updatedAt, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } })
async function fixture(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mototrace-history-'))
  directories.push(directory)
  return { directory, store: createAutomaticBackupStore(directory, options) }
}
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))) })

describe('automatic backups', () => {
  it('captures a legacy original before the first overwrite and survives restart', async () => {
    const { store, directory } = await fixture()
    await fs.mkdir(path.join(directory, 'notes'))
    await fs.writeFile(path.join(directory, 'notes/plans.json'), note('original'))
    await store.write('notes/plans.json', note('overwritten'))
    const reopened = createAutomaticBackupStore(directory)
    const entries = await reopened.list('notes/plans.json')
    expect(entries).toHaveLength(2)
    expect((await reopened.read(entries[1].id)).content).toBe(note('original'))
    expect((await reopened.read(entries[0].id)).content).toBe(note('overwritten'))
  })

  it('deduplicates unchanged content and timestamp-only note saves, with no full-data scan', async () => {
    const { store, directory } = await fixture()
    await store.write('notes/plans.json', note('original'))
    await store.write('notes/plans.json', note('original', '2026-02-01'))
    await store.write('notes/plans.json', note('original', '2026-02-01'))
    expect(await store.list()).toHaveLength(1)
    expect(await fs.readdir(path.join(directory, 'backups/automatic/blobs'))).toHaveLength(1)
  })

  it('serializes concurrent saves without losing intermediate versions or colliding temporary files', async () => {
    const { store, directory } = await fixture()
    await Promise.all(['first', 'second', 'third'].map(text => store.write('notes/plans.json', note(text))))
    expect(await fs.readFile(path.join(directory, 'notes/plans.json'), 'utf8')).toBe(note('third'))
    const versions = await store.list('notes/plans.json')
    expect(versions).toHaveLength(3)
    expect((await store.read(versions[1].id)).content).toBe(note('second'))
  })

  it('backs up deleted notes and restores copies without overwriting or resurrecting other notes', async () => {
    const { store, directory } = await fixture()
    await store.write('notes/plans.json', note('recover me'))
    await store.write('notes/index.json', JSON.stringify([{ id: 'plans', title: 'Plans' }]))
    await store.delete('notes/plans.json')
    expect(JSON.parse(await fs.readFile(path.join(directory, 'notes/index.json'), 'utf8'))).toEqual([])
    await expect(fs.stat(path.join(directory, 'notes/plans.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    const deleted = (await store.list('notes/plans.json')).find(entry => entry.reason === 'delete')
    const restored = await createAutomaticBackupStore(directory).restore(deleted.id)
    expect(restored.copied).toBe(true)
    const copy = JSON.parse(await fs.readFile(path.join(directory, restored.path), 'utf8'))
    expect(copy.id).not.toBe('plans')
    expect(copy.content).toEqual(JSON.parse(note('recover me')).content)
    expect(JSON.parse(await fs.readFile(path.join(directory, 'notes/index.json'), 'utf8'))[0].id).toBe(copy.id)
  })

  it('keeps the original and note index intact when checkpoint writes fail', async () => {
    const { directory } = await fixture()
    await fs.mkdir(path.join(directory, 'notes'))
    await fs.writeFile(path.join(directory, 'notes/plans.json'), note('precious'))
    await fs.writeFile(path.join(directory, 'notes/index.json'), '[{"id":"plans"}]')
    const store = createAutomaticBackupStore(directory, { io: { ...fs, open: async full => {
      if (full.includes('automatic')) throw new Error('disk full')
      return fs.open(full, 'w')
    } } })
    await expect(store.write('notes/plans.json', note('bad'))).rejects.toThrow('disk full')
    await expect(store.delete('notes/plans.json')).rejects.toThrow('disk full')
    expect(await fs.readFile(path.join(directory, 'notes/plans.json'), 'utf8')).toBe(note('precious'))
    expect(await fs.readFile(path.join(directory, 'notes/index.json'), 'utf8')).toBe('[{"id":"plans"}]')
  })

  it('rolls back the index if deletion itself fails', async () => {
    const { directory } = await fixture()
    const store = createAutomaticBackupStore(directory, { io: { ...fs, unlink: async full => {
      if (full.endsWith(path.join('notes', 'plans.json'))) throw new Error('file busy')
      return fs.unlink(full)
    } } })
    await store.write('notes/plans.json', note('precious'))
    await store.write('notes/index.json', '[{"id":"plans"}]')
    await expect(store.delete('notes/plans.json')).rejects.toThrow('file busy')
    expect(await fs.readFile(path.join(directory, 'notes/index.json'), 'utf8')).toBe('[{"id":"plans"}]')
    expect(await fs.readFile(path.join(directory, 'notes/plans.json'), 'utf8')).toBe(note('precious'))
  })

  it('restores daily records selectively and checkpoints the replaced current contents', async () => {
    const { store, directory } = await fixture()
    await store.write('2026/10/04.json', '{"value":"old"}')
    const original = (await store.list())[0]
    await store.write('2026/10/04.json', '{"value":"current"}')
    await store.restore(original.id)
    expect(await fs.readFile(path.join(directory, '2026/10/04.json'), 'utf8')).toBe('{"value":"old"}')
    const entries = await store.list('2026/10/04.json')
    expect((await store.read(entries[1].id)).content).toBe('{"value":"current"}')
  })

  it('rejects traversal, history mutation, and forged revision IDs', async () => {
    const { store } = await fixture()
    await expect(store.write('../outside.json', '{}')).rejects.toThrow('Path traversal')
    await expect(store.write('backups/automatic/index.json', '[]')).rejects.toThrow('read-only')
    await expect(store.delete('backups/automatic/index.json')).rejects.toThrow('read-only')
    await expect(store.read('../../secret')).rejects.toThrow('not found')
  })

  it('blocks overwrite when the existing checkpoint is corrupt', async () => {
    const { store, directory } = await fixture()
    await store.write('notes/plans.json', note('precious'))
    const entry = (await store.list())[0]
    await fs.writeFile(path.join(directory, 'backups/automatic/blobs', `${entry.hash}.gz`), 'corrupt')
    await expect(store.write('notes/plans.json', note('bad'))).rejects.toThrow()
    expect(await fs.readFile(path.join(directory, 'notes/plans.json'), 'utf8')).toBe(note('precious'))
  })

  it('refuses an overwrite if capacity cannot preserve both old and new contents', async () => {
    const { store, directory } = await fixture({ maxBytes: 1 })
    await fs.writeFile(path.join(directory, 'metadata.json'), '{"precious":true}')
    await expect(store.write('metadata.json', '{}')).rejects.toThrow('capacity')
    expect(await fs.readFile(path.join(directory, 'metadata.json'), 'utf8')).toBe('{"precious":true}')
  })

  it('keeps recent edits and sparse hourly/daily history while bounding per-file versions', () => {
    const now = 40 * 86400000
    const entries = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), path: 'notes/a.json', capturedAt: now - i * 60000 }))
    const retained = retainRevisions(entries, now)
    expect(retained.length).toBeLessThanOrEqual(76)
    for (let i = 0; i < 20; i++) expect(retained.some(entry => entry.id === String(i))).toBe(true)
    expect(retained.some(entry => now - entry.capturedAt > 86400000)).toBe(true)
  })
})
