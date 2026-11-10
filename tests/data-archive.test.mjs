import { describe, expect, it } from 'vitest'
import { findInvalidArchiveEntries, readArchiveJsonEntries, zipFilesToBase64 } from '../src/renderer/src/utils/dataArchive.js'
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

  it('flags paths that could leave the data directory', () => {
    const bad = ['../outside.json', 'a/../../outside.json', '/etc/x.json', 'C:/x.json', 'C:\\x.json', '..\\x.json']
    const found = findInvalidArchiveEntries(bad.map(path => ({ path, text: '{}' })))
    expect(found.map(entry => entry.path)).toEqual(bad)
    expect(found.every(entry => entry.reason === 'path')).toBe(true)
  })
})
