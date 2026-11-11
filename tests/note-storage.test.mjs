import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadNotesFromDisk } from '../src/renderer/src/utils/noteStorage.js'
import { handOverPendingWrite } from '../src/renderer/src/utils/leftoverSaves.js'

// A fake data folder behind window.api.fs: { 'notes/index.json': text, 'notes/a.json': text, ... }
let files
beforeEach(() => {
  files = {}
  globalThis.window = {
    api: {
      fs: {
        readFile: async (path) => (path in files ? { ok: true, data: files[path] } : { ok: false, error: 'ENOENT' }),
        listDir: async (dir) => ({
          ok: true,
          data: Object.keys(files).filter(path => path.startsWith(`${dir}/`)).map(path => path.slice(dir.length + 1))
        })
      }
    }
  }
})
afterEach(() => { delete globalThis.window })

const note = (id, title, updatedAt = '2026-01-01T00:00:00.000Z') => JSON.stringify({
  id, title, createdAt: updatedAt, updatedAt, archived: false, pinned: false,
  content: { type: 'doc', content: [{ type: 'paragraph' }] }
})

describe('loading the notes', () => {
  it('lists the notes the index names', async () => {
    files['notes/index.json'] = JSON.stringify([{ id: 'a', title: 'A', updatedAt: '2026-01-01T00:00:00.000Z' }])
    files['notes/a.json'] = note('a', 'A')
    expect((await loadNotesFromDisk()).map(item => item.id)).toEqual(['a'])
  })

  it('adopts a note file the index does not list (an older index imported over a newer one)', async () => {
    files['notes/index.json'] = JSON.stringify([{ id: 'old', title: 'Old' }])
    files['notes/old.json'] = note('old', 'Old')
    files['notes/newer.json'] = note('newer', 'Created after the backup', '2026-06-01T00:00:00.000Z')
    const loaded = await loadNotesFromDisk()
    expect(loaded.map(item => item.id).sort()).toEqual(['newer', 'old'])
    expect(loaded.find(item => item.id === 'newer').title).toBe('Created after the backup')
  })

  it('rebuilds the list from the files when the index is missing or damaged', async () => {
    files['notes/x.json'] = note('x', 'X')
    expect((await loadNotesFromDisk()).map(item => item.id)).toEqual(['x'])
    files['notes/index.json'] = '{not json'
    let corrupt = 0
    expect((await loadNotesFromDisk({ onIndexCorrupt: () => corrupt++ })).map(item => item.id)).toEqual(['x'])
    expect(corrupt).toBe(1)
  })

  it('ignores temporary and set-aside files', async () => {
    files['notes/index.json'] = '[]'
    files['notes/a.json.tmp'] = '{}'
    files['notes/b.json.incomplete'] = '{}'
    expect(await loadNotesFromDisk()).toEqual([])
  })
})

describe('a note whose save failed when its page was left', () => {
  it('is shown as it was edited, not as the older file, including a note that never reached the disk', async () => {
    files['notes/index.json'] = JSON.stringify([{ id: 'a', title: 'A' }])
    files['notes/a.json'] = note('a', 'A on disk')
    const edited = { id: 'a', title: 'A edited', content: { type: 'doc', content: [] }, updatedAt: '2026-02-01T00:00:00.000Z', pinned: false, archived: false }
    const fresh = { id: 'fresh', title: 'Never saved', content: { type: 'doc', content: [] }, updatedAt: '2026-03-01T00:00:00.000Z', pinned: false, archived: false }
    const flushes = new Map()
    const reg = { registerPendingFlush: (key, fn) => flushes.set(key, fn), unregisterPendingFlush: key => flushes.delete(key) }
    const fail = async () => ({ ok: false })
    await handOverPendingWrite({ key: 'note:a', value: { note: edited, notes: [edited] }, write: fail, ...reg })
    await handOverPendingWrite({ key: 'note:fresh', value: { note: fresh, notes: [fresh] }, write: fail, ...reg })

    const loaded = await loadNotesFromDisk()
    expect(loaded.find(item => item.id === 'a').title).toBe('A edited')
    expect(loaded.find(item => item.id === 'fresh').title).toBe('Never saved')
    expect(loaded.map(item => item.id)).toEqual(['fresh', 'a'])
    flushes.clear()
  })
})
