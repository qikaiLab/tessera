import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadNotesFromDisk } from '../src/renderer/src/utils/noteStorage.js'

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
