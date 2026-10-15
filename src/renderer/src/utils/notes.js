// The note model shared by the notes page and the notes drawer: what a note looks like on disk,
// how it is cleaned up, ordered, found and described. No React and no file access in here.

import { extractPlainText } from './richText'

export const NOTES_INDEX_PATH = 'notes/index.json'
export const UNTITLED_NOTE = '无标题便签'

const NOTE_FONT_MIN = 12
const NOTE_FONT_MAX = 24
const NOTE_FONT_DEFAULT = 14
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const notePath = (id) => `notes/${id}.json`

export const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })

export function generateNoteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function cloneNoteContent(content) {
  try {
    return JSON.parse(JSON.stringify(content || emptyDoc()))
  } catch {
    return emptyDoc()
  }
}

export const noteTitle = (note) => note?.title?.trim() || UNTITLED_NOTE

export const buildDuplicateTitle = (title) => `${title?.trim() || UNTITLED_NOTE} 副本`

export function normalizeNoteFontSize(value) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(NOTE_FONT_MAX, Math.max(NOTE_FONT_MIN, parsed)) : NOTE_FONT_DEFAULT
}

// ─── Dates a note can be linked to ────────────────────────────────────────────

export function isValidDateString(value) {
  if (!DATE_PATTERN.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

// A link is a single day or a range, both stored as { type, start, end }; anything else is none.
export function normalizeDateLink(value) {
  if (!value || typeof value !== 'object') return null
  const start = String(value.start || '')
  const end = String(value.end || value.start || '')
  if (!isValidDateString(start) || !isValidDateString(end) || start > end) return null
  return {
    type: value.type === 'range' && start !== end ? 'range' : 'single',
    start,
    end
  }
}

function formatDateShort(value) {
  if (!isValidDateString(value)) return ''
  const [, month, day] = value.split('-')
  return `${month}/${day}`
}

export function formatDateLinkLabel(dateLink) {
  const clean = normalizeDateLink(dateLink)
  if (!clean) return ''
  if (clean.type === 'single') return formatDateShort(clean.start)
  return `${formatDateShort(clean.start)} - ${formatDateShort(clean.end)}`
}

// The form state of the "link a date" panel.
export function dateLinkToDraft(dateLink) {
  const clean = normalizeDateLink(dateLink)
  if (!clean) return { type: 'none', start: '', end: '' }
  return { type: clean.type, start: clean.start, end: clean.end }
}

export function isLinkedToDate(note, dateStr) {
  const dateLink = normalizeDateLink(note.dateLink)
  return Boolean(dateLink && dateLink.start <= dateStr && dateLink.end >= dateStr)
}

export const DATE_FILTER = Object.freeze({
  ALL: 'all',
  LINKED: 'linked',
  UNLINKED: 'unlinked',
  CONTAINS: 'contains',
  OVERLAP: 'overlap'
})

export const EMPTY_DATE_FILTER = Object.freeze({ mode: DATE_FILTER.ALL, date: '', start: '', end: '' })

// An incomplete filter (no date picked yet) lets every note through.
export function dateLinkMatchesFilter(note, filter) {
  const dateLink = normalizeDateLink(note.dateLink)
  if (filter.mode === DATE_FILTER.LINKED) return Boolean(dateLink)
  if (filter.mode === DATE_FILTER.UNLINKED) return !dateLink
  if (filter.mode === DATE_FILTER.CONTAINS) {
    if (!isValidDateString(filter.date)) return true
    return Boolean(dateLink && dateLink.start <= filter.date && dateLink.end >= filter.date)
  }
  if (filter.mode === DATE_FILTER.OVERLAP) {
    if (!isValidDateString(filter.start) || !isValidDateString(filter.end) || filter.start > filter.end) return true
    return Boolean(dateLink && dateLink.start <= filter.end && dateLink.end >= filter.start)
  }
  return true
}

// ─── Reading and shaping notes ────────────────────────────────────────────────

// What the notes index keeps about a note (everything but the content).
export function normalizeNoteMeta(note) {
  return {
    id: note.id,
    title: noteTitle(note),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    fontSize: normalizeNoteFontSize(note.fontSize),
    dateLink: normalizeDateLink(note.dateLink)
  }
}

// A note file, filling gaps from what the index knows; null when the file is not valid JSON.
export function parseNote(raw, fallbackMeta) {
  try {
    const parsed = JSON.parse(raw)
    return {
      id: parsed.id || fallbackMeta.id,
      title: parsed.title || fallbackMeta.title || '',
      content: parsed.content || emptyDoc(),
      createdAt: parsed.createdAt || fallbackMeta.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || fallbackMeta.updatedAt || new Date().toISOString(),
      pinned: Boolean(parsed.pinned ?? fallbackMeta.pinned),
      archived: Boolean(parsed.archived ?? fallbackMeta.archived),
      fontSize: normalizeNoteFontSize(parsed.fontSize ?? fallbackMeta.fontSize),
      dateLink: normalizeDateLink(parsed.dateLink ?? fallbackMeta.dateLink)
    }
  } catch {
    return null
  }
}

// The note as it is written to its own file.
export function serializeNote(note) {
  return JSON.stringify({
    ...note,
    title: noteTitle(note),
    content: note.content || emptyDoc(),
    fontSize: normalizeNoteFontSize(note.fontSize),
    dateLink: normalizeDateLink(note.dateLink)
  }, null, 2)
}

export const extractNoteText = extractPlainText

export const countNoteChars = (content) => extractNoteText(content).length

export function noteMatchesQuery(note, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return `${note.title} ${extractNoteText(note.content)}`.toLowerCase().includes(needle)
}

// ─── Order ────────────────────────────────────────────────────────────────────

const byUpdatedDesc = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))

// Pinned notes first, then the most recently edited.
export function compareNotes(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return byUpdatedDesc(a, b)
}

export const compareLatest = byUpdatedDesc

export function formatNoteTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// The notes page's list: current or archived notes, matching the search and the date filter.
export function filterNotes(notes, { query, showArchived, dateFilter }) {
  return notes
    .filter(note => (showArchived ? note.archived : !note.archived))
    .filter(note => noteMatchesQuery(note, query))
    .filter(note => dateLinkMatchesFilter(note, dateFilter))
    .sort(compareNotes)
}

// ─── Making notes ─────────────────────────────────────────────────────────────

export function createBlankNote({ pinned = false, dateLink = null, fontSize } = {}) {
  const now = new Date().toISOString()
  return {
    id: generateNoteId(),
    title: '',
    content: emptyDoc(),
    createdAt: now,
    updatedAt: now,
    pinned,
    archived: false,
    fontSize: normalizeNoteFontSize(fontSize),
    dateLink
  }
}

export function duplicateNote(source) {
  const now = new Date().toISOString()
  return {
    ...source,
    id: generateNoteId(),
    title: buildDuplicateTitle(source.title),
    content: cloneNoteContent(source.content),
    createdAt: now,
    updatedAt: now,
    pinned: Boolean(source.pinned),
    archived: Boolean(source.archived),
    fontSize: normalizeNoteFontSize(source.fontSize),
    dateLink: normalizeDateLink(source.dateLink)
  }
}

// `patch` applied to a note that is being edited right now (touches `updatedAt`).
export function editNote(note, patch) {
  return {
    ...note,
    ...patch,
    updatedAt: new Date().toISOString(),
    dateLink: normalizeDateLink(patch.dateLink !== undefined ? patch.dateLink : note.dateLink)
  }
}

// `nextNote` swapped into the list, which stays in order.
export function replaceNote(notes, nextNote) {
  return notes.map(note => (note.id === nextNote.id ? { ...note, ...nextNote } : note)).sort(compareNotes)
}

export function deleteNoteConfirmation(note) {
  return {
    title: '删除便签',
    message: `确定要删除便签「${noteTitle(note)}」吗？\n便签将从列表中移除，可在设置的自动历史中恢复为副本。`,
    confirmText: '删除',
    cancelText: '取消',
    danger: true
  }
}
