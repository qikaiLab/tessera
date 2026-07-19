import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TiptapEditor from '../components/TiptapEditor'
import SaveStatusBadge from '../components/SaveStatusBadge'
import { useApp } from '../context/AppContext'
import { separator, showContextMenu, useContextMenuCommand } from '../utils/contextMenu'
import { FULLSCREEN_EDITOR_SHORTCUT_LABEL } from '../utils/editorShortcuts'
import './Notes.css'

const NOTES_INDEX_PATH = 'notes/index.json'
const SAVE_IDLE = 'idle'
const SAVE_UNSAVED = 'unsaved'
const SAVE_SAVING = 'saving'
const SAVE_SAVED = 'saved'
const SAVE_FAILED = 'failed'
const NOTES_LIST_MIN = 240
const NOTES_LIST_MAX = 520
const NOTES_LIST_DEFAULT = 320
const NOTE_FONT_MIN = 12
const NOTE_FONT_MAX = 24
const NOTE_FONT_DEFAULT = 14
const DATE_FILTER_ALL = 'all'
const DATE_FILTER_LINKED = 'linked'
const DATE_FILTER_UNLINKED = 'unlinked'
const DATE_FILTER_CONTAINS = 'contains'
const DATE_FILTER_OVERLAP = 'overlap'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function generateId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function emptyDoc() {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function cloneNoteContent(content) {
  try {
    return JSON.parse(JSON.stringify(content || emptyDoc()))
  } catch {
    return emptyDoc()
  }
}

function buildDuplicateTitle(title) {
  return `${title?.trim() || '无标题便签'} 副本`
}

function notePath(id) {
  return `notes/${id}.json`
}

function isValidDateString(value) {
  if (!DATE_RE.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function normalizeDateLink(value) {
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

function normalizeMeta(note) {
  return {
    id: note.id,
    title: note.title?.trim() || '无标题便签',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    fontSize: normalizeFontSize(note.fontSize),
    dateLink: normalizeDateLink(note.dateLink)
  }
}

function normalizeFontSize(value) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? clamp(parsed, NOTE_FONT_MIN, NOTE_FONT_MAX) : NOTE_FONT_DEFAULT
}

function extractText(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    try {
      return extractText(JSON.parse(value))
    } catch {
      return value
    }
  }
  if (Array.isArray(value.content)) {
    return value.content.map(extractText).join('')
  }
  if (value.type === 'text') return value.text || ''
  return ''
}

function countNoteChars(content) {
  return extractText(content).length
}

function parseNote(raw, fallbackMeta) {
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
      fontSize: normalizeFontSize(parsed.fontSize ?? fallbackMeta.fontSize),
      dateLink: normalizeDateLink(parsed.dateLink ?? fallbackMeta.dateLink)
    }
  } catch {
    return null
  }
}

function formatDateShort(value) {
  if (!isValidDateString(value)) return ''
  const [, month, day] = value.split('-')
  return `${month}/${day}`
}

function formatDateLinkLabel(dateLink) {
  const clean = normalizeDateLink(dateLink)
  if (!clean) return ''
  if (clean.type === 'single') return formatDateShort(clean.start)
  return `${formatDateShort(clean.start)} - ${formatDateShort(clean.end)}`
}

function dateLinkToDraft(dateLink) {
  const clean = normalizeDateLink(dateLink)
  if (!clean) return { type: 'none', start: '', end: '' }
  return {
    type: clean.type,
    start: clean.start,
    end: clean.end
  }
}

function dateLinkMatchesFilter(note, filter) {
  const dateLink = normalizeDateLink(note.dateLink)
  if (filter.mode === DATE_FILTER_LINKED) return Boolean(dateLink)
  if (filter.mode === DATE_FILTER_UNLINKED) return !dateLink
  if (filter.mode === DATE_FILTER_CONTAINS) {
    if (!isValidDateString(filter.date)) return true
    return Boolean(dateLink && dateLink.start <= filter.date && dateLink.end >= filter.date)
  }
  if (filter.mode === DATE_FILTER_OVERLAP) {
    if (!isValidDateString(filter.start) || !isValidDateString(filter.end) || filter.start > filter.end) return true
    return Boolean(dateLink && dateLink.start <= filter.end && dateLink.end >= filter.start)
  }
  return true
}

function formatTime(value) {
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

export default function Notes() {
  const { showToast, confirm, registerPendingFlush, unregisterPendingFlush } = useApp()
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [currentNote, setCurrentNote] = useState(null)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [dateFilter, setDateFilter] = useState({
    mode: DATE_FILTER_ALL,
    date: '',
    start: '',
    end: ''
  })
  const [saveStatus, setSaveStatus] = useState(SAVE_IDLE)
  const [loading, setLoading] = useState(true)
  const [charCount, setCharCount] = useState(0)
  const [fullScreenNoteId, setFullScreenNoteId] = useState(null)
  const [dateLinkPanelOpen, setDateLinkPanelOpen] = useState(false)
  const [dateLinkDraft, setDateLinkDraft] = useState(() => dateLinkToDraft(null))
  const [notesListWidth, setNotesListWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('mototrace_notes_list_width') || '', 10)
    return Number.isFinite(saved) ? clamp(saved, NOTES_LIST_MIN, NOTES_LIST_MAX) : NOTES_LIST_DEFAULT
  })
  const saveTimerRef = useRef(null)
  const pendingNoteRef = useRef(null)
  const titleInputRef = useRef(null)

  const writeIndex = useCallback(async (nextNotes) => {
    const cleanIndex = nextNotes.map(normalizeMeta)
    return window.api.fs.writeFile(NOTES_INDEX_PATH, JSON.stringify(cleanIndex, null, 2))
  }, [])

  const writeNote = useCallback(async (note) => {
    const payload = {
      ...note,
      title: note.title?.trim() || '无标题便签',
      content: note.content || emptyDoc(),
      fontSize: normalizeFontSize(note.fontSize),
      dateLink: normalizeDateLink(note.dateLink)
    }
    return window.api.fs.writeFile(notePath(payload.id), JSON.stringify(payload, null, 2))
  }, [])

  const persistNoteNow = useCallback(async (note, nextNotes) => {
    setSaveStatus(SAVE_SAVING)
    const noteResult = await writeNote(note)
    if (!noteResult.ok) {
      setSaveStatus(SAVE_FAILED)
      showToast('便签保存失败', 'error')
      return false
    }
    const indexResult = await writeIndex(nextNotes)
    if (!indexResult.ok) {
      setSaveStatus(SAVE_FAILED)
      showToast('便签索引保存失败', 'error')
      return false
    }
    setSaveStatus(SAVE_SAVED)
    setTimeout(() => setSaveStatus(SAVE_IDLE), 1600)
    return true
  }, [showToast, writeIndex, writeNote])

  const flushPending = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingNoteRef.current
    if (!pending) return true
    pendingNoteRef.current = null
    return persistNoteNow(pending.note, pending.notes)
  }, [persistNoteNow])

  const scheduleSave = useCallback((note, nextNotes) => {
    pendingNoteRef.current = { note, notes: nextNotes }
    setSaveStatus(SAVE_UNSAVED)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const pending = pendingNoteRef.current
      saveTimerRef.current = null
      pendingNoteRef.current = null
      if (pending) await persistNoteNow(pending.note, pending.notes)
    }, 800)
  }, [persistNoteNow])

  const loadNotes = useCallback(async () => {
    setLoading(true)
    const indexResult = await window.api.fs.readFile(NOTES_INDEX_PATH)
    let metas = []
    if (indexResult.ok) {
      try {
        const parsed = JSON.parse(indexResult.data)
        metas = Array.isArray(parsed) ? parsed : []
      } catch {
        showToast('便签索引读取失败', 'error')
      }
    }

    const loaded = await Promise.all(
      metas.map(async meta => {
        const result = await window.api.fs.readFile(notePath(meta.id))
        if (!result.ok) return normalizeMeta(meta)
        return parseNote(result.data, meta) || normalizeMeta(meta)
      })
    )
    loaded.sort(compareNotes)
    setNotes(loaded)
    const firstActive = loaded.find(n => !n.archived) || loaded[0] || null
    setSelectedId(firstActive?.id || null)
    setCurrentNote(firstActive || null)
    setCharCount(firstActive ? countNoteChars(firstActive.content) : 0)
    setFullScreenNoteId(null)
    setDateLinkPanelOpen(false)
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    const flushNotes = async () => {
      await flushPending()
    }
    registerPendingFlush('notes', flushNotes)
    return () => unregisterPendingFlush('notes')
  }, [flushPending, registerPendingFlush, unregisterPendingFlush])

  const selectNote = useCallback(async (note) => {
    await flushPending()
    setSelectedId(note.id)
    setCurrentNote(note)
    setCharCount(countNoteChars(note.content))
    setFullScreenNoteId(null)
    setDateLinkPanelOpen(false)
    setSaveStatus(SAVE_IDLE)
  }, [flushPending])

  const updateCurrentNote = useCallback((patch) => {
    if (!currentNote) return
    const updatedAt = new Date().toISOString()
    const nextNote = {
      ...currentNote,
      ...patch,
      updatedAt,
      dateLink: patch.dateLink !== undefined
        ? normalizeDateLink(patch.dateLink)
        : normalizeDateLink(currentNote.dateLink)
    }
    const nextNotes = notes.map(note =>
      note.id === nextNote.id ? { ...note, ...nextNote } : note
    ).sort(compareNotes)
    setCurrentNote(nextNote)
    setNotes(nextNotes)
    scheduleSave(nextNote, nextNotes)
  }, [currentNote, notes, scheduleSave])

  const createNote = useCallback(async () => {
    await flushPending()
    const now = new Date().toISOString()
    const note = {
      id: generateId(),
      title: '',
      content: emptyDoc(),
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      fontSize: normalizeFontSize(localStorage.getItem('mototrace_notes_font_size')),
      dateLink: null
    }
    const nextNotes = [note, ...notes].sort(compareNotes)
    setNotes(nextNotes)
    setCurrentNote(note)
    setSelectedId(note.id)
    const ok = await persistNoteNow(note, nextNotes)
    if (ok) {
      showToast('已新建便签', 'success', 1200)
      setCharCount(0)
      setTimeout(() => titleInputRef.current?.focus(), 40)
    }
  }, [flushPending, notes, persistNoteNow, showToast])

  const duplicateNoteById = useCallback(async (noteId) => {
    const source = notes.find(note => note.id === noteId)
    if (!source) return

    await flushPending()
    const now = new Date().toISOString()
    const duplicate = {
      ...source,
      id: generateId(),
      title: buildDuplicateTitle(source.title),
      content: cloneNoteContent(source.content),
      createdAt: now,
      updatedAt: now,
      pinned: Boolean(source.pinned),
      archived: Boolean(source.archived),
      fontSize: normalizeFontSize(source.fontSize),
      dateLink: normalizeDateLink(source.dateLink)
    }
    const nextNotes = [duplicate, ...notes].sort(compareNotes)
    setNotes(nextNotes)
    setCurrentNote(duplicate)
    setSelectedId(duplicate.id)
    setCharCount(countNoteChars(duplicate.content))
    setFullScreenNoteId(null)
    setDateLinkPanelOpen(false)

    const ok = await persistNoteNow(duplicate, nextNotes)
    if (ok) {
      showToast('已新建便签副本', 'success', 1200)
      setTimeout(() => titleInputRef.current?.focus(), 40)
    }
  }, [flushPending, notes, persistNoteNow, showToast])

  const togglePinnedById = useCallback(async (noteId) => {
    const target = notes.find(note => note.id === noteId)
    if (!target) return

    await flushPending()
    const nextNote = {
      ...target,
      pinned: !target.pinned,
      updatedAt: new Date().toISOString()
    }
    const nextNotes = notes.map(note =>
      note.id === noteId ? { ...note, ...nextNote } : note
    ).sort(compareNotes)
    setNotes(nextNotes)
    if (currentNote?.id === noteId) setCurrentNote(nextNote)
    await persistNoteNow(nextNote, nextNotes)
  }, [currentNote, flushPending, notes, persistNoteNow])

  const toggleArchivedById = useCallback(async (noteId) => {
    const target = notes.find(note => note.id === noteId)
    if (!target) return

    await flushPending()
    const nextNote = {
      ...target,
      archived: !target.archived,
      pinned: target.archived ? target.pinned : false,
      updatedAt: new Date().toISOString()
    }
    const nextNotes = notes.map(note =>
      note.id === noteId ? { ...note, ...nextNote } : note
    ).sort(compareNotes)
    setNotes(nextNotes)
    if (currentNote?.id === noteId) setCurrentNote(nextNote)
    await persistNoteNow(nextNote, nextNotes)
  }, [currentNote, flushPending, notes, persistNoteNow])

  const deleteNoteById = useCallback(async (noteId) => {
    const target = notes.find(note => note.id === noteId)
    if (!target) return

    const title = target.title?.trim() || '无标题便签'
    const confirmed = await confirm({
      title: '删除便签',
      message: `确定要删除便签「${title}」吗？\n该操作会永久删除便签文件，无法撤销。`,
      confirmText: '删除',
      cancelText: '取消',
      danger: true
    })
    if (!confirmed) return

    await flushPending()
    const nextNotes = notes.filter(note => note.id !== noteId).sort(compareNotes)
    const indexResult = await writeIndex(nextNotes)
    if (!indexResult.ok) {
      showToast('便签索引更新失败', 'error')
      return
    }

    const deleteResult = await window.api.fs.deleteFile(notePath(noteId))
    if (!deleteResult.ok) {
      showToast('便签文件删除失败', 'error')
      return
    }

    const nextSelected = currentNote?.id === noteId
      ? (nextNotes.find(note => showArchived ? note.archived : !note.archived) || nextNotes[0] || null)
      : currentNote

    setNotes(nextNotes)
    setCurrentNote(nextSelected)
    setSelectedId(nextSelected?.id || null)
    setCharCount(nextSelected ? countNoteChars(nextSelected.content) : 0)
    setFullScreenNoteId(null)
    setDateLinkPanelOpen(false)
    setSaveStatus(SAVE_IDLE)
    showToast('便签已删除', 'success', 1200)
  }, [confirm, currentNote, flushPending, notes, showArchived, showToast, writeIndex])

  const openDateLinkPanelById = useCallback(async (noteId) => {
    const note = notes.find(item => item.id === noteId)
    if (!note) return
    await selectNote(note)
    setDateLinkDraft(dateLinkToDraft(note.dateLink))
    setDateLinkPanelOpen(true)
  }, [notes, selectNote])

  useContextMenuCommand('notes-list', useCallback((id, context) => {
    const note = context?.noteId ? notes.find(item => item.id === context.noteId) : null
    if (id === 'new') {
      createNote()
      return
    }
    if (!note) return
    if (id === 'duplicate') {
      duplicateNoteById(note.id)
      return
    }
    if (id === 'toggle-pin') {
      togglePinnedById(note.id)
      return
    }
    if (id === 'toggle-archive') {
      toggleArchivedById(note.id)
      return
    }
    if (id === 'edit-date-link') {
      openDateLinkPanelById(note.id)
      return
    }
    if (id === 'delete') {
      deleteNoteById(note.id)
    }
  }, [createNote, deleteNoteById, duplicateNoteById, notes, openDateLinkPanelById, toggleArchivedById, togglePinnedById]))

  const handleNoteListContextMenu = useCallback((event, note) => {
    showContextMenu(event, [
      { id: 'new', label: '新建' },
      { id: 'duplicate', label: '新建副本' },
      { id: 'toggle-pin', label: note.pinned ? '取消置顶' : '置顶' },
      { id: 'toggle-archive', label: note.archived ? '移出归档' : '归档' },
      { id: 'edit-date-link', label: '关联日期…' },
      separator,
      { id: 'delete', label: '删除', tone: 'danger' }
    ], {
      scope: 'notes-list',
      noteId: note.id
    })
  }, [])

  const handleNotesListBlankContextMenu = useCallback((event) => {
    if (event.target !== event.currentTarget && !event.target.closest?.('.notes-empty-list')) return
    showContextMenu(event, [
      { id: 'new', label: '新建' }
    ], {
      scope: 'notes-list'
    })
  }, [])

  const togglePinned = useCallback(() => {
    if (!currentNote) return
    updateCurrentNote({ pinned: !currentNote.pinned })
  }, [currentNote, updateCurrentNote])

  const toggleArchived = useCallback(() => {
    if (!currentNote) return
    updateCurrentNote({ archived: !currentNote.archived, pinned: currentNote.archived ? currentNote.pinned : false })
  }, [currentNote, updateCurrentNote])

  const deleteCurrentNote = useCallback(async () => {
    if (!currentNote) return
    const title = currentNote.title?.trim() || '无标题便签'
    const confirmed = await confirm({
      title: '删除便签',
      message: `确定要删除便签「${title}」吗？\n该操作会永久删除便签文件，无法撤销。`,
      confirmText: '删除',
      cancelText: '取消',
      danger: true
    })
    if (!confirmed) return

    await flushPending()
    const nextNotes = notes.filter(note => note.id !== currentNote.id).sort(compareNotes)
    const indexResult = await writeIndex(nextNotes)
    if (!indexResult.ok) {
      showToast('便签索引更新失败', 'error')
      return
    }

    const deleteResult = await window.api.fs.deleteFile(notePath(currentNote.id))
    if (!deleteResult.ok) {
      showToast('便签文件删除失败', 'error')
      return
    }

    const nextSelected = nextNotes.find(note => showArchived ? note.archived : !note.archived) || nextNotes[0] || null
    setNotes(nextNotes)
    setCurrentNote(nextSelected)
    setSelectedId(nextSelected?.id || null)
    setCharCount(nextSelected ? countNoteChars(nextSelected.content) : 0)
    setFullScreenNoteId(null)
    setDateLinkPanelOpen(false)
    setSaveStatus(SAVE_IDLE)
    showToast('便签已删除', 'success', 1200)
  }, [confirm, currentNote, flushPending, notes, showArchived, showToast, writeIndex])

  const openDateLinkPanel = () => {
    if (!currentNote) return
    setDateLinkDraft(dateLinkToDraft(currentNote.dateLink))
    setDateLinkPanelOpen(prev => !prev)
  }

  const clearDateLink = () => {
    updateCurrentNote({ dateLink: null })
    setDateLinkDraft(dateLinkToDraft(null))
    setDateLinkPanelOpen(false)
    showToast('已清除关联日期', 'success', 1200)
  }

  const saveDateLink = () => {
    if (dateLinkDraft.type === 'none') {
      clearDateLink()
      return
    }

    const start = dateLinkDraft.start
    const end = dateLinkDraft.type === 'single' ? dateLinkDraft.start : dateLinkDraft.end
    if (!isValidDateString(start) || !isValidDateString(end)) {
      showToast('请选择有效日期', 'error')
      return
    }
    if (start > end) {
      showToast('结束日期不能早于开始日期', 'error')
      return
    }

    const nextDateLink = normalizeDateLink({
      type: dateLinkDraft.type,
      start,
      end
    })
    updateCurrentNote({ dateLink: nextDateLink })
    setDateLinkDraft(dateLinkToDraft(nextDateLink))
    setDateLinkPanelOpen(false)
    showToast('已更新关联日期', 'success', 1200)
  }

  const clearDateFilter = () => {
    setDateFilter({
      mode: DATE_FILTER_ALL,
      date: '',
      start: '',
      end: ''
    })
  }

  const handleFontSizeChange = (size) => {
    const nextSize = normalizeFontSize(size)
    localStorage.setItem('mototrace_notes_font_size', String(nextSize))
    updateCurrentNote({ fontSize: nextSize })
  }

  const startNotesListResize = (event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = notesListWidth
    document.body.classList.add('is-resizing')

    const handleMove = (moveEvent) => {
      const nextWidth = clamp(startWidth + moveEvent.clientX - startX, NOTES_LIST_MIN, NOTES_LIST_MAX)
      setNotesListWidth(nextWidth)
      localStorage.setItem('mototrace_notes_list_width', String(nextWidth))
    }

    const handleUp = () => {
      document.body.classList.remove('is-resizing')
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter(note => showArchived ? note.archived : !note.archived)
      .filter(note => {
        if (!q) return true
        return `${note.title} ${extractText(note.content)}`.toLowerCase().includes(q)
      })
      .filter(note => dateLinkMatchesFilter(note, dateFilter))
      .sort(compareNotes)
  }, [notes, query, showArchived, dateFilter])

  const activeFontSize = normalizeFontSize(currentNote?.fontSize)
  const isDateFilterActive = dateFilter.mode !== DATE_FILTER_ALL

  return (
    <div className="notes-page" style={{ gridTemplateColumns: `${notesListWidth}px minmax(0, 1fr)` }}>
      <aside className="notes-list-panel">
        <div className="notes-list-header">
          <div className="notes-heading">
            <h1 className="notes-title">便签</h1>
            <span className="notes-count">{filteredNotes.length} 条</span>
          </div>
          <button className="btn btn-primary btn-icon notes-new-btn" onClick={createNote} title="新建便签">
            +
          </button>
        </div>

        <div className="notes-search-row">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="input search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索便签"
            />
            {query && (
              <button
                type="button"
                className="notes-search-clear"
                onClick={() => setQuery('')}
                title="清空搜索"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="notes-filter-bar">
          <div className="notes-status-toggle" role="group" aria-label="便签状态">
            <button
              type="button"
              className={`notes-status-pill ${!showArchived ? 'active' : ''}`}
              onClick={() => setShowArchived(false)}
            >
              当前
            </button>
            <button
              type="button"
              className={`notes-status-pill ${showArchived ? 'active' : ''}`}
              onClick={() => setShowArchived(true)}
            >
              归档
            </button>
          </div>

          <div className={`notes-date-filter ${isDateFilterActive ? 'active' : ''}`}>
            <select
              className="input notes-date-filter-select"
              value={dateFilter.mode}
              onChange={e => setDateFilter(prev => ({ ...prev, mode: e.target.value }))}
              title="日期筛选"
            >
              <option value={DATE_FILTER_ALL}>全部日期</option>
              <option value={DATE_FILTER_LINKED}>有日期关联</option>
              <option value={DATE_FILTER_UNLINKED}>无日期关联</option>
              <option value={DATE_FILTER_CONTAINS}>包含某一天</option>
              <option value={DATE_FILTER_OVERLAP}>与时间段交集</option>
            </select>
            {isDateFilterActive && (
              <button
                type="button"
                className="btn btn-ghost btn-icon notes-date-filter-clear"
                onClick={clearDateFilter}
                title="清除日期筛选"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className={`notes-date-filter-fields ${isDateFilterActive ? 'active' : ''}`}>
          {dateFilter.mode === DATE_FILTER_CONTAINS && (
            <input
              className="input notes-date-filter-input"
              type="date"
              value={dateFilter.date}
              onChange={e => setDateFilter(prev => ({ ...prev, date: e.target.value }))}
            />
          )}
          {dateFilter.mode === DATE_FILTER_OVERLAP && (
            <div className="notes-date-filter-range">
              <input
                className="input notes-date-filter-input"
                type="date"
                value={dateFilter.start}
                onChange={e => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              />
              <span>至</span>
              <input
                className="input notes-date-filter-input"
                type="date"
                value={dateFilter.end}
                onChange={e => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="notes-list" onContextMenu={handleNotesListBlankContextMenu}>
          {loading ? (
            <div className="notes-list-loading">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="notes-empty-list">
              <span>{showArchived ? '暂无归档便签' : '暂无便签'}</span>
            </div>
          ) : (
            filteredNotes.map(note => (
              <button
                key={note.id}
                className={`notes-list-item ${selectedId === note.id ? 'active' : ''}`}
                onClick={() => selectNote(note)}
                onContextMenu={(event) => handleNoteListContextMenu(event, note)}
              >
                <div className="notes-list-item-top">
                  <span className="notes-list-title">{note.title?.trim() || '无标题便签'}</span>
                  {note.pinned && <span className="notes-pin-dot">置顶</span>}
                </div>
                <p className="notes-list-snippet">{extractText(note.content) || '空白便签'}</p>
                <div className="notes-list-footer">
                  <span className="notes-list-time">{formatTime(note.updatedAt)}</span>
                  {normalizeDateLink(note.dateLink) && (
                    <span className={`notes-date-badge ${normalizeDateLink(note.dateLink)?.type === 'range' ? 'range' : ''}`}>
                      {formatDateLinkLabel(note.dateLink)}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
      <div
        className="notes-resize-handle"
        style={{ left: notesListWidth - 3 }}
        onMouseDown={startNotesListResize}
        title="拖动调整便签列表宽度"
      />

      <main className={`notes-editor-panel ${fullScreenNoteId ? 'notes-fullscreen-active-parent' : ''}`}>
        {loading ? (
          <div className="notes-editor-loading">
            <div className="notes-editor-loading-header">
              <div className="skeleton notes-title-skeleton" />
              <div className="skeleton notes-actions-skeleton" />
            </div>
            <div className="skeleton notes-meta-skeleton" />
            <div className="notes-editor-body">
              <div className="notes-editor-loading-card">
                <div className="skeleton notes-line-skeleton wide" />
                <div className="skeleton notes-line-skeleton" />
                <div className="skeleton notes-line-skeleton short" />
              </div>
            </div>
          </div>
        ) : currentNote ? (
          <>
            <div className="notes-editor-header">
              <input
                ref={titleInputRef}
                className="notes-title-input selectable"
                value={currentNote.title}
                onChange={e => updateCurrentNote({ title: e.target.value })}
                placeholder="无标题便签"
              />
              <div className="notes-editor-actions">
                <SaveStatusBadge status={saveStatus} />
                <div className="card-font-controls">
                  <button
                    className="btn btn-ghost btn-xs font-ctrl-btn"
                    onClick={() => handleFontSizeChange(activeFontSize - 1)}
                    title="缩小字体"
                  >
                    A-
                  </button>
                  <span className="font-ctrl-label">{activeFontSize}</span>
                  <button
                    className="btn btn-ghost btn-xs font-ctrl-btn"
                    onClick={() => handleFontSizeChange(activeFontSize + 1)}
                    title="放大字体"
                  >
                    A+
                  </button>
                </div>
                <button
                  className="btn btn-ghost btn-xs btn-icon fullscreen-btn"
                  onClick={() => setFullScreenNoteId(prev => prev === currentNote.id ? null : currentNote.id)}
                  title={`全屏编辑 (${FULLSCREEN_EDITOR_SHORTCUT_LABEL})`}
                  aria-label={`进入全屏编辑，快捷键 ${FULLSCREEN_EDITOR_SHORTCUT_LABEL}`}
                >
                  ⛶
                </button>
                <button className={`btn btn-ghost btn-sm ${currentNote.pinned ? 'notes-action-active' : ''}`} onClick={togglePinned}>
                  {currentNote.pinned ? '取消置顶' : '置顶'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={toggleArchived}>
                  {currentNote.archived ? '移出归档' : '归档'}
                </button>
                <button className="btn btn-ghost btn-sm notes-delete-btn" onClick={deleteCurrentNote}>
                  删除
                </button>
              </div>
            </div>
            <div className="notes-editor-meta">
              <span>创建 {formatTime(currentNote.createdAt)}</span>
              <span>更新 {formatTime(currentNote.updatedAt)}</span>
              <div className="notes-date-link-wrap">
                <button
                  className={`notes-date-link-btn ${normalizeDateLink(currentNote.dateLink) ? 'linked' : ''}`}
                  onClick={openDateLinkPanel}
                >
                  {formatDateLinkLabel(currentNote.dateLink) || '未关联日期'}
                </button>
                {dateLinkPanelOpen && (
                  <div className="notes-date-link-panel">
                    <div className="notes-date-link-panel-title">关联日期</div>
                    <div className="notes-date-link-type">
                      <button
                        className={dateLinkDraft.type === 'none' ? 'active' : ''}
                        onClick={() => setDateLinkDraft(prev => ({ ...prev, type: 'none' }))}
                      >
                        无
                      </button>
                      <button
                        className={dateLinkDraft.type === 'single' ? 'active' : ''}
                        onClick={() => setDateLinkDraft(prev => ({ ...prev, type: 'single', end: prev.start }))}
                      >
                        单日
                      </button>
                      <button
                        className={dateLinkDraft.type === 'range' ? 'active' : ''}
                        onClick={() => setDateLinkDraft(prev => ({ ...prev, type: 'range', end: prev.end || prev.start }))}
                      >
                        时间段
                      </button>
                    </div>
                    {dateLinkDraft.type !== 'none' && (
                      <div className="notes-date-link-fields">
                        <label>
                          <span>{dateLinkDraft.type === 'single' ? '日期' : '开始'}</span>
                          <input
                            className="input"
                            type="date"
                            value={dateLinkDraft.start}
                            onChange={e => setDateLinkDraft(prev => ({
                              ...prev,
                              start: e.target.value,
                              end: prev.type === 'single' ? e.target.value : prev.end
                            }))}
                          />
                        </label>
                        {dateLinkDraft.type === 'range' && (
                          <label>
                            <span>结束</span>
                            <input
                              className="input"
                              type="date"
                              value={dateLinkDraft.end}
                              onChange={e => setDateLinkDraft(prev => ({ ...prev, end: e.target.value }))}
                            />
                          </label>
                        )}
                      </div>
                    )}
                    <div className="notes-date-link-actions">
                      <button className="btn btn-ghost btn-sm" onClick={clearDateLink}>清除</button>
                      <button className="btn btn-primary btn-sm" onClick={saveDateLink}>保存</button>
                    </div>
                  </div>
                )}
              </div>
              <span>{charCount} 字</span>
            </div>
            <div className="notes-editor-body">
              <TiptapEditor
                value={currentNote.content || emptyDoc()}
                onChange={(content) => updateCurrentNote({ content })}
                placeholder="写下长期计划、灵感、素材或任何不属于某一天的内容..."
                isFullScreen={fullScreenNoteId === currentNote.id}
                onToggleFullScreen={() => setFullScreenNoteId(prev => prev === currentNote.id ? null : currentNote.id)}
                onSave={flushPending}
                fontSize={activeFontSize}
                onFontSizeChange={handleFontSizeChange}
                onCharCountChange={setCharCount}
              />
            </div>
          </>
        ) : (
          <div className="notes-empty-editor">
            <div className="empty-state">
              <span className="empty-state-icon">N</span>
              <p className="empty-state-title">选择或新建一条便签</p>
              <p className="empty-state-desc">便签不会随日期切换，适合长期计划、灵感池和持续整理的资料。</p>
              <button className="btn btn-primary" onClick={createNote}>新建便签</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function compareNotes(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
}
