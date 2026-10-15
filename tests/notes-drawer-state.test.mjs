import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  forgetDrawerSelected,
  getDrawerVisibleNotes,
  readDrawerState,
  writeDrawerState
} from '../src/renderer/src/components/NotesDrawer/drawerState.js'

const doc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const day = '2026-10-13'

const notes = [
  { id: 'linked', title: '今天', content: doc('跑步计划'), pinned: false, updatedAt: '2026-10-10T00:00:00Z', dateLink: { type: 'single', start: day, end: day } },
  { id: 'range', title: '本周', content: doc('周计划'), pinned: false, updatedAt: '2026-10-12T00:00:00Z', dateLink: { type: 'range', start: '2026-10-12', end: '2026-10-18' } },
  { id: 'pinned', title: '长期', content: doc('读书'), pinned: true, updatedAt: '2026-01-01T00:00:00Z', dateLink: null },
  { id: 'archived', title: '旧的', content: doc('归档内容'), pinned: false, archived: true, updatedAt: '2026-10-11T00:00:00Z', dateLink: { type: 'single', start: day, end: day } }
]

const ids = (list) => list.map(note => note.id)

describe('which notes a drawer tab shows', () => {
  it('"linked" lists the notes covering the day, newest first', () => {
    expect(ids(getDrawerVisibleNotes(notes, { mode: 'linked', dateStr: day, query: '', selectedId: null })))
      .toEqual(['range', 'linked'])
  })

  it('"pinned" lists pinned notes and "latest" lists everything current by update time', () => {
    expect(ids(getDrawerVisibleNotes(notes, { mode: 'pinned', dateStr: day, query: '', selectedId: null }))).toEqual(['pinned'])
    expect(ids(getDrawerVisibleNotes(notes, { mode: 'latest', dateStr: day, query: '', selectedId: null })))
      .toEqual(['range', 'linked', 'pinned'])
  })

  it('searches titles and text', () => {
    expect(ids(getDrawerVisibleNotes(notes, { mode: 'latest', dateStr: day, query: '读书', selectedId: null }))).toEqual(['pinned'])
    expect(ids(getDrawerVisibleNotes(notes, { mode: 'latest', dateStr: day, query: '本周', selectedId: null }))).toEqual(['range'])
  })

  it('always keeps the open note in the list, even archived or not matching', () => {
    const shown = ids(getDrawerVisibleNotes(notes, { mode: 'pinned', dateStr: day, query: '不存在', selectedId: 'archived' }))
    expect(shown).toEqual(['archived'])
  })
})

describe('the drawer remembers its tab and note per day', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubSession() {
    const store = new Map()
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, value)
      }
    })
  }

  it('stores state by day and merges patches', () => {
    stubSession()
    expect(readDrawerState(day)).toBeNull()
    writeDrawerState(day, { mode: 'pinned' })
    writeDrawerState(day, { selectedId: 'a' })
    expect(readDrawerState(day)).toEqual({ mode: 'pinned', selectedId: 'a' })
    expect(readDrawerState('2026-10-14')).toBeNull()
    forgetDrawerSelected(day)
    expect(readDrawerState(day)).toEqual({ mode: 'pinned', selectedId: null })
  })

  it('works without session storage', () => {
    vi.stubGlobal('window', {})
    expect(readDrawerState(day)).toBeNull()
    expect(() => writeDrawerState(day, { mode: 'latest' })).not.toThrow()
  })
})
