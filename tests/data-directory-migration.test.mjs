import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MIGRATION_MARKER, applyPendingDataDirChange, copyDataDirectory, planDataDirectoryChange, summarizeDirectory
} from '../src/main/dataDirectoryMigration.js'

let root
let source
const at = (...parts) => path.join(root, ...parts)

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content)
}

async function snapshot(dir, base = '') {
  const result = {}
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) Object.assign(result, await snapshot(path.join(dir, entry.name), relative))
    else result[relative] = await fs.readFile(path.join(dir, entry.name), 'utf8')
  }
  return result
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mototrace-migration-'))
  source = at('source')
  await write(path.join(source, 'sections.json'), '[{"id":"diary"}]')
  await write(path.join(source, '2026', '10', '13.json'), '{"diary":{"value":"今天"}}')
  await write(path.join(source, 'notes', 'index.json'), '[]')
  await write(path.join(source, 'backups', 'automatic', 'index.json'), '[]')
  await fs.mkdir(path.join(source, 'empty-folder'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('planning a data folder change', () => {
  it('recognises the folder already in use, in any spelling', async () => {
    expect((await planDataDirectoryChange({ current: source, target: source })).kind).toBe('same')
    expect((await planDataDirectoryChange({ current: source, target: path.join(source, '..', 'source') })).kind).toBe('same')
    expect((await planDataDirectoryChange({ current: source, target: source.toUpperCase(), platform: 'win32' })).kind).toBe('same')
  })

  it('refuses folders inside the data, or containing it', async () => {
    expect((await planDataDirectoryChange({ current: source, target: path.join(source, 'inner') })).kind).toBe('nested')
    expect((await planDataDirectoryChange({ current: source, target: root })).kind).toBe('nested')
  })

  it('refuses relative paths and files', async () => {
    expect((await planDataDirectoryChange({ current: source, target: 'relative/dir' })).kind).toBe('unusable')
    expect((await planDataDirectoryChange({ current: source, target: '' })).kind).toBe('unusable')
    const file = at('a-file.txt')
    await write(file, 'x')
    const plan = await planDataDirectoryChange({ current: source, target: file })
    expect(plan.kind).toBe('unusable')
  })

  it('offers to copy into an empty or missing folder, and counts what would be copied', async () => {
    const empty = at('empty')
    await fs.mkdir(empty)
    const plan = await planDataDirectoryChange({ current: source, target: empty })
    expect(plan).toMatchObject({ kind: 'empty', files: 4 })
    expect(plan.bytes).toBeGreaterThan(0)
    expect((await planDataDirectoryChange({ current: source, target: at('not-yet') })).kind).toBe('empty')
    // The probe file used to test writing is gone again.
    expect(await fs.readdir(empty)).toEqual([])
  })

  it('ignores the files a file manager adds when judging whether a folder is empty', async () => {
    const target = at('target')
    await write(path.join(target, 'desktop.ini'), '[.ShellClassInfo]')
    expect((await planDataDirectoryChange({ current: source, target })).kind).toBe('empty')
  })

  it('never treats a folder with other files as a place to copy into', async () => {
    const target = at('target')
    await write(path.join(target, 'holiday-photos', 'a.jpg'), 'x')
    expect((await planDataDirectoryChange({ current: source, target })).kind).toBe('foreign')
  })

  it('uses a folder that already holds MotoTrace data as it is', async () => {
    const target = at('target')
    await write(path.join(target, 'sections.json'), '[]')
    await write(path.join(target, '2025', '01', '01.json'), '{}')
    expect(await planDataDirectoryChange({ current: source, target })).toMatchObject({ kind: 'existing', files: 2 })
  })

  it('does not mistake an ordinary folder for a data folder', async () => {
    const documents = at('documents')
    await write(path.join(documents, '2024', 'Trip', 'a.json'), '{}')
    await write(path.join(documents, '2024', 'vacation.jpg'), 'x')
    await write(path.join(documents, 'notes', 'todo.txt'), 'x')
    expect((await planDataDirectoryChange({ current: source, target: documents })).kind).toBe('foreign')

    const onlyNotes = at('only-notes')
    await fs.mkdir(path.join(onlyNotes, 'notes'), { recursive: true })
    expect((await planDataDirectoryChange({ current: source, target: onlyNotes })).kind).toBe('foreign')
  })

  it('recognises real data by its own files or by day files', async () => {
    const byNotes = at('by-notes')
    await write(path.join(byNotes, 'notes', 'index.json'), '[]')
    expect((await planDataDirectoryChange({ current: source, target: byNotes })).kind).toBe('existing')
    const byDays = at('by-days')
    await write(path.join(byDays, '2025', '03', '07.json'), '{}')
    expect((await planDataDirectoryChange({ current: source, target: byDays })).kind).toBe('existing')
  })

  it('recognises a folder left behind by an interrupted copy', async () => {
    const target = at('target')
    await write(path.join(target, MIGRATION_MARKER), 'x')
    await write(path.join(target, 'sections.json'), '[')
    expect((await planDataDirectoryChange({ current: source, target })).kind).toBe('resume')
  })
})

describe('copying the data', () => {
  it('copies every file, keeps the source untouched and removes the marker when verified', async () => {
    const before = await snapshot(source)
    const target = at('target')
    const result = await copyDataDirectory(source, target)
    expect(result.files).toBe(4)
    expect(await snapshot(target)).toEqual(before)
    expect(await snapshot(source)).toEqual(before)
    await expect(fs.stat(path.join(target, 'empty-folder'))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(target, MIGRATION_MARKER))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await summarizeDirectory(target)).toEqual(await summarizeDirectory(source))
  })

  it('keeps modification times', async () => {
    const stamp = new Date('2024-05-06T07:08:09Z')
    await fs.utimes(path.join(source, 'sections.json'), stamp, stamp)
    const target = at('target')
    await copyDataDirectory(source, target)
    expect((await fs.stat(path.join(target, 'sections.json'))).mtime.getTime()).toBe(stamp.getTime())
  })

  it('can be run again over a folder an earlier attempt left half done', async () => {
    const target = at('target')
    await write(path.join(target, MIGRATION_MARKER), 'x')
    await write(path.join(target, 'sections.json'), 'half')
    await write(path.join(target, '2026', '10', '13.json.migrating'), 'part')
    const result = await copyDataDirectory(source, target)
    expect(result.files).toBe(4)
    expect((await snapshot(target))['sections.json']).toBe('[{"id":"diary"}]')
  })
})

describe('carrying out a scheduled change at startup', () => {
  const request = (to, copy = true, from = source) => ({ from, to, copy })

  it('does nothing without a request', async () => {
    expect(await applyPendingDataDirChange({ pending: undefined, currentDir: source })).toBeNull()
    expect(await applyPendingDataDirChange({ pending: 'oops', currentDir: source })).toBeNull()
  })

  it('switches to a verified copy and leaves the old folder whole', async () => {
    const before = await snapshot(source)
    const target = at('target')
    const result = await applyPendingDataDirChange({ pending: request(target), currentDir: source })
    expect(result).toMatchObject({ status: 'switched', from: source, to: target })
    expect(result.copied.files).toBe(4)
    expect(await snapshot(source)).toEqual(before)
    expect(await snapshot(target)).toEqual(before)
  })

  it('stays on the old folder when the copy cannot be verified', async () => {
    const before = await snapshot(source)
    const target = at('target')
    // A directory where a file has to go makes the copy fail halfway.
    await fs.mkdir(path.join(target, 'sections.json.migrating'), { recursive: true })
    await fs.writeFile(path.join(target, MIGRATION_MARKER), 'x')
    const result = await applyPendingDataDirChange({ pending: request(target), currentDir: source })
    expect(result.status).toBe('failed')
    expect(await snapshot(source)).toEqual(before)
    // The half-copied folder is still marked, so it is not mistaken for a data folder.
    await expect(fs.stat(path.join(target, MIGRATION_MARKER))).resolves.toBeTruthy()
  })

  it('refuses a request made for another folder than the one in use', async () => {
    const result = await applyPendingDataDirChange({ pending: request(at('target'), true, at('elsewhere')), currentDir: source })
    expect(result).toMatchObject({ status: 'failed', kind: 'stale' })
    await expect(fs.stat(at('target'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses to copy into a folder that was filled with other things since', async () => {
    const target = at('target')
    await write(path.join(target, 'photos', 'a.jpg'), 'x')
    const result = await applyPendingDataDirChange({ pending: request(target), currentDir: source })
    expect(result).toMatchObject({ status: 'failed', kind: 'foreign' })
    expect(await fs.readdir(target)).toEqual(['photos'])
  })

  it('refuses to copy over a folder that already holds data', async () => {
    const target = at('target')
    await write(path.join(target, 'sections.json'), '[{"id":"theirs"}]')
    const result = await applyPendingDataDirChange({ pending: request(target), currentDir: source })
    expect(result).toMatchObject({ status: 'failed', kind: 'existing' })
    expect((await snapshot(target))['sections.json']).toBe('[{"id":"theirs"}]')
  })

  it('uses an existing data folder without copying, and refuses one that is not', async () => {
    const existing = at('existing')
    await write(path.join(existing, 'sections.json'), '[]')
    expect(await applyPendingDataDirChange({ pending: request(existing, false), currentDir: source }))
      .toMatchObject({ status: 'switched', to: existing, copied: null })

    const bare = at('bare')
    await fs.mkdir(bare)
    expect(await applyPendingDataDirChange({ pending: request(bare, false), currentDir: source }))
      .toMatchObject({ status: 'failed', kind: 'empty' })
  })
})
