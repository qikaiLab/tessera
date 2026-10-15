import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DATE_FILTER,
  buildDuplicateTitle,
  compareNotes,
  countNoteChars,
  createBlankNote,
  dateLinkMatchesFilter,
  dateLinkToDraft,
  deleteNoteConfirmation,
  duplicateNote,
  editNote,
  extractNoteText,
  formatDateLinkLabel,
  isLinkedToDate,
  isValidDateString,
  noteMatchesQuery,
  normalizeDateLink,
  normalizeNoteFontSize,
  normalizeNoteMeta,
  parseNote,
  replaceNote,
  serializeNote
} from '../src/renderer/src/utils/notes.js'
import { loadNotesFromDisk } from '../src/renderer/src/utils/noteStorage.js'

const doc = (...texts) => ({
  type: 'doc',
  content: texts.map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
})

describe('date links', () => {
  it('only accepts real calendar days', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2026-2-3')).toBe(false)
    expect(isValidDateString('')).toBe(false)
  })

  it('normalizes a link to a single day or a range, and drops anything else', () => {
    expect(normalizeDateLink({ type: 'range', start: '2026-10-01', end: '2026-10-05' }))
      .toEqual({ type: 'range', start: '2026-10-01', end: '2026-10-05' })
    // A "range" of one day is a single day; a missing end means the start.
    expect(normalizeDateLink({ type: 'range', start: '2026-10-01', end: '2026-10-01' }).type).toBe('single')
    expect(normalizeDateLink({ start: '2026-10-01' })).toEqual({ type: 'single', start: '2026-10-01', end: '2026-10-01' })
    expect(normalizeDateLink({ start: '2026-10-05', end: '2026-10-01' })).toBeNull()
    expect(normalizeDateLink({ start: 'nope' })).toBeNull()
    expect(normalizeDateLink(null)).toBeNull()
    expect(normalizeDateLink('2026-10-01')).toBeNull()
  })

  it('labels and drafts links', () => {
    expect(formatDateLinkLabel({ type: 'single', start: '2026-10-04', end: '2026-10-04' })).toBe('10/04')
    expect(formatDateLinkLabel({ type: 'range', start: '2026-10-04', end: '2026-10-11' })).toBe('10/04 - 10/11')
    expect(formatDateLinkLabel(null)).toBe('')
    expect(dateLinkToDraft(null)).toEqual({ type: 'none', start: '', end: '' })
    expect(dateLinkToDraft({ start: '2026-10-04' })).toEqual({ type: 'single', start: '2026-10-04', end: '2026-10-04' })
  })

  it('knows whether a note covers a day', () => {
    const note = { dateLink: { type: 'range', start: '2026-10-04', end: '2026-10-11' } }
    expect(isLinkedToDate(note, '2026-10-04')).toBe(true)
    expect(isLinkedToDate(note, '2026-10-11')).toBe(true)
    expect(isLinkedToDate(note, '2026-10-12')).toBe(false)
    expect(isLinkedToDate({}, '2026-10-04')).toBe(false)
  })

  it('filters notes by date link, letting everything through while the filter is incomplete', () => {
    const linked = { dateLink: { type: 'range', start: '2026-10-04', end: '2026-10-11' } }
    const plain = { dateLink: null }
    expect(dateLinkMatchesFilter(linked, { mode: DATE_FILTER.ALL })).toBe(true)
    expect(dateLinkMatchesFilter(linked, { mode: DATE_FILTER.LINKED })).toBe(true)
    expect(dateLinkMatchesFilter(plain, { mode: DATE_FILTER.LINKED })).toBe(false)
    expect(dateLinkMatchesFilter(plain, { mode: DATE_FILTER.UNLINKED })).toBe(true)
    expect(dateLinkMatchesFilter(linked, { mode: DATE_FILTER.CONTAINS, date: '2026-10-08' })).toBe(true)
    expect(dateLinkMatchesFilter(linked, { mode: DATE_FILTER.CONTAINS, date: '2026-10-20' })).toBe(false)
    expect(dateLinkMatchesFilter(plain, { mode: DATE_FILTER.CONTAINS, date: '' })).toBe(true)
    expect(dateLinkMatchesFilter(linked, { mode: DATE_FILTER.OVERLAP, start: '2026-10-10', end: '2026-10-20' })).toBe(true)
    expect(dateLinkMatchesFilter(linked, { mode: DATE_FILTER.OVERLAP, start: '2026-10-12', end: '2026-10-20' })).toBe(false)
    expect(dateLinkMatchesFilter(plain, { mode: DATE_FILTER.OVERLAP, start: '2026-10-20', end: '2026-10-10' })).toBe(true)
  })
})

describe('reading notes', () => {
  it('clamps the font size and falls back to 14', () => {
    expect(normalizeNoteFontSize('18')).toBe(18)
    expect(normalizeNoteFontSize(99)).toBe(24)
    expect(normalizeNoteFontSize(2)).toBe(12)
    expect(normalizeNoteFontSize(null)).toBe(14)
    expect(normalizeNoteFontSize('x')).toBe(14)
  })

  it('keeps only index fields in the meta and names an untitled note', () => {
    const meta = normalizeNoteMeta({ id: 'a', title: '  ', content: doc('x'), pinned: 1, fontSize: '30' })
    expect(meta).toEqual({
      id: 'a', title: '无标题便签', createdAt: undefined, updatedAt: undefined,
      pinned: true, archived: false, fontSize: 24, dateLink: null
    })
    expect(meta).not.toHaveProperty('content')
  })

  it('fills a note file from the index and rejects broken JSON', () => {
    const parsed = parseNote('{"id":"a","content":{"type":"doc","content":[]}}', { id: 'a', title: '来自索引', pinned: true })
    expect(parsed.title).toBe('来自索引')
    expect(parsed.pinned).toBe(true)
    expect(parseNote('{ not json', { id: 'a' })).toBeNull()
    // No content at all: an empty document, never undefined.
    expect(parseNote('{"id":"a"}', { id: 'a' }).content.type).toBe('doc')
  })

  it('serializes with a title, content and clean links', () => {
    const written = JSON.parse(serializeNote({ id: 'a', title: '', dateLink: { start: 'bad' }, fontSize: 'x' }))
    expect(written.title).toBe('无标题便签')
    expect(written.content.type).toBe('doc')
    expect(written.dateLink).toBeNull()
    expect(written.fontSize).toBe(14)
  })

  it('extracts the text of documents, serialized documents and plain text', () => {
    expect(extractNoteText(doc('你好', '世界'))).toBe('你好世界')
    expect(extractNoteText(JSON.stringify(doc('abc')))).toBe('abc')
    expect(extractNoteText('plain')).toBe('plain')
    expect(extractNoteText(null)).toBe('')
    expect(countNoteChars(doc('12345'))).toBe(5)
  })

  it('matches a query against the title and the text, ignoring case', () => {
    const note = { title: 'Plan', content: doc('Read a Book') }
    expect(noteMatchesQuery(note, 'plan')).toBe(true)
    expect(noteMatchesQuery(note, '  BOOK ')).toBe(true)
    expect(noteMatchesQuery(note, 'nothing')).toBe(false)
    expect(noteMatchesQuery(note, '   ')).toBe(true)
  })
})

describe('ordering and editing', () => {
  it('puts pinned notes first, then the most recently edited', () => {
    const notes = [
      { id: 'old', pinned: false, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'new', pinned: false, updatedAt: '2026-03-01T00:00:00Z' },
      { id: 'pin', pinned: true, updatedAt: '2025-01-01T00:00:00Z' }
    ]
    expect([...notes].sort(compareNotes).map(note => note.id)).toEqual(['pin', 'new', 'old'])
  })

  it('creates blank notes and copies', () => {
    const blank = createBlankNote({ pinned: true, fontSize: '16', dateLink: { type: 'single', start: '2026-10-01', end: '2026-10-01' } })
    expect(blank).toMatchObject({ title: '', pinned: true, archived: false, fontSize: 16 })
    expect(blank.id).toBeTruthy()

    const source = { ...blank, title: '计划', content: doc('内容') }
    const copy = duplicateNote(source)
    expect(copy.id).not.toBe(source.id)
    expect(copy.title).toBe('计划 副本')
    expect(copy.content).toEqual(source.content)
    expect(copy.content).not.toBe(source.content)
    expect(buildDuplicateTitle('')).toBe('无标题便签 副本')
  })

  it('applies an edit, touching the update time and keeping the link clean', () => {
    const note = { id: 'a', title: 'x', updatedAt: '2000-01-01T00:00:00Z', dateLink: { start: '2026-10-01' } }
    const edited = editNote(note, { title: 'y' })
    expect(edited.title).toBe('y')
    expect(edited.updatedAt > note.updatedAt).toBe(true)
    expect(edited.dateLink).toEqual({ type: 'single', start: '2026-10-01', end: '2026-10-01' })
    expect(editNote(note, { dateLink: null }).dateLink).toBeNull()
  })

  it('swaps an edited note into the list and keeps the list in order', () => {
    const notes = [
      { id: 'a', pinned: false, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'b', pinned: false, updatedAt: '2026-02-01T00:00:00Z' }
    ]
    const next = replaceNote(notes, { id: 'a', pinned: false, updatedAt: '2026-03-01T00:00:00Z' })
    expect(next.map(note => note.id)).toEqual(['a', 'b'])
  })

  it('words the delete confirmation with the note title', () => {
    const confirmation = deleteNoteConfirmation({ title: '计划' })
    expect(confirmation.message).toContain('「计划」')
    expect(confirmation.danger).toBe(true)
    expect(deleteNoteConfirmation({ title: '' }).message).toContain('「无标题便签」')
  })
})

describe('loading notes from disk', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubDisk(files) {
    vi.stubGlobal('window', {
      api: {
        fs: {
          readFile: async (path) => (path in files ? { ok: true, data: files[path] } : { ok: false }),
          listDir: async () => ({
            ok: true,
            data: Object.keys(files).filter(path => path.startsWith('notes/')).map(path => path.slice('notes/'.length))
          })
        }
      }
    })
  }

  const noteFile = (id, extra = {}) => JSON.stringify({ id, title: id, content: doc(id), updatedAt: '2026-01-01T00:00:00Z', ...extra })

  it('reads the notes the index lists, newest and pinned first', async () => {
    stubDisk({
      'notes/index.json': JSON.stringify([{ id: 'a' }, { id: 'b' }]),
      'notes/a.json': noteFile('a'),
      'notes/b.json': noteFile('b', { updatedAt: '2026-05-01T00:00:00Z' })
    })
    const notes = await loadNotesFromDisk()
    expect(notes.map(note => note.id)).toEqual(['b', 'a'])
  })

  it('rebuilds the list from the note files when the index is corrupt, and says so', async () => {
    stubDisk({
      'notes/index.json': '{ broken',
      'notes/a.json': noteFile('a'),
      'notes/b.json': noteFile('b')
    })
    const onIndexCorrupt = vi.fn()
    const notes = await loadNotesFromDisk({ onIndexCorrupt })
    expect(onIndexCorrupt).toHaveBeenCalledTimes(1)
    expect(notes.map(note => note.id).sort()).toEqual(['a', 'b'])
  })

  it('rebuilds quietly when there is no index at all', async () => {
    stubDisk({ 'notes/a.json': noteFile('a') })
    const onIndexCorrupt = vi.fn()
    const notes = await loadNotesFromDisk({ onIndexCorrupt })
    expect(onIndexCorrupt).not.toHaveBeenCalled()
    expect(notes.map(note => note.id)).toEqual(['a'])
  })

  it('keeps a note whose file cannot be read as its index entry', async () => {
    stubDisk({
      'notes/index.json': JSON.stringify([{ id: 'gone', title: '只剩索引', pinned: true }]),
    })
    const notes = await loadNotesFromDisk()
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ id: 'gone', title: '只剩索引', pinned: true })
    expect(notes[0]).not.toHaveProperty('content')
  })
})
