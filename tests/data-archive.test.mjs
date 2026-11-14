import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { ARCHIVE_LIMITS, ArchiveLimitError, findInvalidArchiveEntries, isBackupsFolderEntry, readArchiveJsonEntries, zipFilesToBase64 } from '../src/renderer/src/utils/dataArchive.js'
import { NUMBER_DEFAULT_MODE, getNumberDefaultMode, normalizeNumberDefaultMode } from '../src/renderer/src/utils/sectionDefaults.js'

describe('data archive', () => {
  it('round-trips the JSON files of a backup', async () => {
    const base64 = await zipFilesToBase64([
      { path: 'sections.json', content: '[]' },
      { path: '2026/10/13.json', content: '{"diary":{"value":"x"}}' }
    ])
    const entries = await readArchiveJsonEntries(base64)
    expect(entries.map(entry => entry.path).sort()).toEqual(['2026/10/13.json', 'sections.json'])
    expect(entries.find(entry => entry.path === 'sections.json').text).toBe('[]')
  })

  it('leaves out the backup folder, directories and non-JSON files', async () => {
    const base64 = await zipFilesToBase64([
      { path: 'backups/old.json', content: '{}' },
      { path: 'notes/readme.txt', content: 'hello' },
      { path: 'notes/index.json', content: '[]' }
    ])
    const entries = await readArchiveJsonEntries(base64)
    expect(entries.map(entry => entry.path)).toEqual(['notes/index.json'])
  })

  it('treats the backups folder as one folder however Windows would spell it', async () => {
    const base64 = await zipFilesToBase64([
      { path: 'Backups/Automatic/index.json', content: '[]' },
      { path: 'BACKUPS/automatic/blobs/x.json', content: '{}' },
      { path: 'backups./automatic/index.json', content: '[]' },
      { path: 'backups\\automatic\\index.json', content: '[]' },
      { path: 'notes/index.json', content: '[]' },
      { path: 'my-backups/readme.json', content: '{}' }
    ])
    const paths = (await readArchiveJsonEntries(base64)).map(entry => entry.path).sort()
    expect(paths).toEqual(['my-backups/readme.json', 'notes/index.json'])
    expect(isBackupsFolderEntry('Backups/x.json')).toBe(true)
    expect(isBackupsFolderEntry('./backups/x.json')).toBe(true)
    expect(isBackupsFolderEntry('2026/10/13.json')).toBe(false)
  })
})

describe('number default mode', () => {
  it('only knows the manual and carry modes', () => {
    expect(normalizeNumberDefaultMode('carry')).toBe(NUMBER_DEFAULT_MODE.CARRY)
    expect(normalizeNumberDefaultMode('manual')).toBe(NUMBER_DEFAULT_MODE.MANUAL)
    expect(normalizeNumberDefaultMode('anything else')).toBe(NUMBER_DEFAULT_MODE.MANUAL)
    expect(normalizeNumberDefaultMode(undefined)).toBe(NUMBER_DEFAULT_MODE.MANUAL)
  })

  it('reads the mode of a section, defaulting to manual', () => {
    expect(getNumberDefaultMode({ numberDefaultMode: 'carry' })).toBe('carry')
    expect(getNumberDefaultMode({})).toBe('manual')
    expect(getNumberDefaultMode(undefined)).toBe('manual')
  })
})

describe('findInvalidArchiveEntries', () => {
  it('accepts sound JSON files with relative paths', () => {
    expect(findInvalidArchiveEntries([
      { path: '2026/05/01.json', text: '{"a":1}' },
      { path: 'notes/index.json', text: '[]' }
    ])).toEqual([])
  })

  it('flags JSON that does not parse, so a damaged archive never overwrites good files', () => {
    expect(findInvalidArchiveEntries([
      { path: '2026/05/01.json', text: '{"a":1}' },
      { path: '2026/05/02.json', text: '{"a": ' },
      { path: 'sections.json', text: '' }
    ])).toEqual([
      { path: '2026/05/02.json', reason: 'json' },
      { path: 'sections.json', reason: 'json' }
    ])
  })

  it('flags names Windows reads as something other than a plain file: devices, data streams, trailing dots and spaces', () => {
    const bad = ['CON.json', 'notes/nul.json', 'notes/COM3.json', '2026/10/13.json:stream.json', 'a?b.json', 'notes/x*.json', 'notes/name .json'.replace('name .json', 'name .'), 'notes/dir./x.json', 'notes/a|b.json']
    const found = findInvalidArchiveEntries(bad.map(path => ({ path, text: '{}' })))
    expect(found.map(entry => entry.path)).toEqual(bad)
    // Ordinary names, including ones that merely contain a device name, are fine.
    expect(findInvalidArchiveEntries(['notes/connect.json', 'notes/console.json', 'a/./b.json', '日记/2026.json'].map(path => ({ path, text: '{}' })))).toEqual([])
  })

  it('flags paths that could leave the data directory', () => {
    const bad = ['../outside.json', 'a/../../outside.json', '/etc/x.json', 'C:/x.json', 'C:\\x.json', '..\\x.json']
    const found = findInvalidArchiveEntries(bad.map(path => ({ path, text: '{}' })))
    expect(found.map(entry => entry.path)).toEqual(bad)
    expect(found.every(entry => entry.reason === 'path')).toBe(true)
  })
})

describe('archive limits', () => {
  const small = { maxFileBytes: 1024 * 1024, maxEntries: 5, maxEntryBytes: 1000, maxTotalBytes: 1500 }
  const zipOf = async files => zipFilesToBase64(files.map(([path, content]) => ({ path, content })))

  it('has limits far above real data and below what would exhaust memory', () => {
    expect(ARCHIVE_LIMITS.maxEntries).toBeGreaterThanOrEqual(20_000)
    expect(ARCHIVE_LIMITS.maxEntryBytes).toBeGreaterThanOrEqual(16 * 1024 * 1024)
    expect(ARCHIVE_LIMITS.maxTotalBytes).toBeLessThanOrEqual(512 * 1024 * 1024)
    expect(ARCHIVE_LIMITS.maxFileBytes).toBeLessThanOrEqual(ARCHIVE_LIMITS.maxTotalBytes)
  })

  it('refuses a file larger than the limit before opening it', async () => {
    const base64 = await zipOf([['a.json', '{}']])
    await expect(readArchiveJsonEntries(base64, { ...small, maxFileBytes: 10 })).rejects.toBeInstanceOf(ArchiveLimitError)
  })

  it('refuses an archive that declares too many entries, without building them', async () => {
    const base64 = await zipOf(Array.from({ length: 6 }, (_, index) => [`day-${index}.json`, '{}']))
    await expect(readArchiveJsonEntries(base64, small)).rejects.toThrow(/超过 5 个/)
    // The same archive passes when the limit allows it.
    expect(await readArchiveJsonEntries(base64, { ...small, maxEntries: 6 })).toHaveLength(6)
  })

  it('stops inflating a single file that grows past the limit (a ZIP bomb)', async () => {
    // 20 MB of spaces deflates to a few kilobytes; with a 1000 byte limit it must be cut off early.
    const zip = new JSZip()
    zip.file('bomb.json', ' '.repeat(20 * 1024 * 1024), { compression: 'DEFLATE' })
    const bomb = await zip.generateAsync({ type: 'base64' })
    expect(bomb.length).toBeLessThan(100_000)
    await expect(readArchiveJsonEntries(bomb, small)).rejects.toThrow(/bomb\.json/)
  })

  it('refuses when all files together are too large, even if each one is fine', async () => {
    const part = JSON.stringify({ text: 'x'.repeat(700) })
    const base64 = await zipOf([['a.json', part], ['b.json', part], ['c.json', part]])
    await expect(readArchiveJsonEntries(base64, small)).rejects.toThrow(/合计/)
  })

  it('does not count files the import skips', async () => {
    const base64 = await zipOf([
      ['backups/huge.json', 'x'.repeat(5000)],
      ['notes.txt', 'y'.repeat(5000)],
      ['ok.json', '{}']
    ])
    expect((await readArchiveJsonEntries(base64, small)).map(entry => entry.path)).toEqual(['ok.json'])
  })

  it('reads UTF-8 text intact, including characters outside the first plane', async () => {
    const text = JSON.stringify({ diary: '日记 🌱 𠮷 café' })
    const [entry] = await readArchiveJsonEntries(await zipOf([['2026/10/13.json', text]]))
    expect(entry.text).toBe(text)
  })

  it('reports a file that is not a ZIP as an ordinary error, not a limit', async () => {
    await expect(readArchiveJsonEntries(btoa('this is not a zip file at all'))).rejects.not.toBeInstanceOf(ArchiveLimitError)
    await expect(readArchiveJsonEntries('')).rejects.toThrow()
  })
})
