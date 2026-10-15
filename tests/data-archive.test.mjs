import { describe, expect, it } from 'vitest'
import { readArchiveJsonEntries, zipFilesToBase64 } from '../src/renderer/src/utils/dataArchive.js'
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
