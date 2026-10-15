import { describe, expect, it } from 'vitest'
import { dropEmptyEntries } from '../src/renderer/src/utils/dayEntries.js'
import { DEFAULT_SECTIONS, interpretSectionsFile } from '../src/renderer/src/context/sectionsFile.js'
import { clearLegacyMetadata, parseMetadata } from '../src/renderer/src/context/metadataFile.js'

describe('dropEmptyEntries', () => {
  it('keeps only entries that hold something', () => {
    const emptyDoc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
    const kept = dropEmptyEntries({
      number: { value: '0' },
      text: { value: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }) },
      blank: { value: '  ' },
      empty: { value: emptyDoc },
      missing: {},
      nothing: null
    })
    expect(Object.keys(kept).sort()).toEqual(['number', 'text'])
  })
})

describe('reading sections.json', () => {
  it('uses the sections of a valid file and writes nothing', () => {
    const sections = [{ id: 'a', name: 'A', type: 'text', resident: true, order: 0 }]
    expect(interpretSectionsFile({ ok: true, data: JSON.stringify(sections) }))
      .toEqual({ sections, writeDefaults: false })
  })

  it('writes the defaults only when the file is missing (first run)', () => {
    const outcome = interpretSectionsFile({ ok: false, error: 'ENOENT: no such file or directory, open sections.json' })
    expect(outcome.writeDefaults).toBe(true)
    expect(outcome.sections).toEqual(DEFAULT_SECTIONS)
    expect(outcome.notice).toBeUndefined()
  })

  it('never overwrites a file it cannot parse: defaults in memory, a notice, nothing written', () => {
    const outcome = interpretSectionsFile({ ok: true, data: '{ broken' })
    expect(outcome.writeDefaults).toBe(false)
    expect(outcome.sections).toEqual(DEFAULT_SECTIONS)
    expect(outcome.notice.message).toContain('版块配置文件无法读取')
    expect(outcome.parseError).toBeInstanceOf(Error)
  })

  it('treats valid JSON that is not a list as unreadable', () => {
    const outcome = interpretSectionsFile({ ok: true, data: '{"sections": []}' })
    expect(outcome.writeDefaults).toBe(false)
    expect(outcome.notice).toBeTruthy()
  })

  it('never overwrites a file it could not read for another reason', () => {
    const outcome = interpretSectionsFile({ ok: false, error: 'EACCES: permission denied' })
    expect(outcome.writeDefaults).toBe(false)
    expect(outcome.notice.message).toContain('读取版块配置失败')
  })

  it('hands out copies of the defaults', () => {
    const first = interpretSectionsFile({ ok: false, error: 'ENOENT' }).sections
    first[0].name = 'changed'
    expect(DEFAULT_SECTIONS[0].name).toBe('日记')
  })
})

describe('reading metadata.json', () => {
  const storage = (values = {}) => {
    const map = new Map(Object.entries(values))
    return {
      getItem: key => (map.has(key) ? map.get(key) : null),
      removeItem: key => map.delete(key),
      has: key => map.has(key)
    }
  }

  it('reads countdowns, charts and favourites', () => {
    const parsed = parseMetadata(JSON.stringify({
      countdowns: [{ id: 'c' }],
      analytics: [{ id: 'a' }],
      favorites: [{ date: '2026-10-13', sectionId: 'diary' }]
    }), storage())
    expect(parsed.countdowns).toEqual([{ id: 'c' }])
    expect(parsed.analytics).toEqual([{ id: 'a' }])
    expect(parsed.favorites).toHaveLength(1)
    expect(parsed.migrated).toBe(false)
  })

  it('migrates the lists older versions kept in localStorage when the file has none', () => {
    const local = storage({
      mototrace_countdowns: JSON.stringify([{ id: 'old-countdown' }]),
      mototrace_analytics: JSON.stringify([{ id: 'old-chart' }])
    })
    const parsed = parseMetadata('{}', local)
    expect(parsed.countdowns).toEqual([{ id: 'old-countdown' }])
    expect(parsed.analytics).toEqual([{ id: 'old-chart' }])
    expect(parsed.migrated).toBe(true)
    clearLegacyMetadata(local)
    expect(local.has('mototrace_countdowns')).toBe(false)
    expect(local.has('mototrace_analytics')).toBe(false)
  })

  it('prefers the file over localStorage and ignores unusable legacy data', () => {
    const local = storage({ mototrace_countdowns: 'not json', mototrace_analytics: JSON.stringify([{ id: 'old' }]) })
    const parsed = parseMetadata(JSON.stringify({ countdowns: [{ id: 'file' }], analytics: [{ id: 'new' }] }), local)
    expect(parsed.countdowns).toEqual([{ id: 'file' }])
    expect(parsed.analytics).toEqual([{ id: 'new' }])
    expect(parsed.migrated).toBe(false)
  })

  it('throws on invalid JSON so the caller can report it', () => {
    expect(() => parseMetadata('{ nope', storage())).toThrow()
  })
})
