import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TiptapEditor from './TiptapEditor'
import SaveStatusBadge from './SaveStatusBadge'
import { useApp } from '../context/AppContext'
import { isEditableMenuTarget, separator, showContextMenu, useContextMenuCommand } from '../utils/contextMenu'
import './NotesDrawer.css'

const NOTES_INDEX_PATH = 'notes/index.json'
const SAVE_IDLE = 'idle'
const SAVE_UNSAVED = 'unsaved'
const SAVE_SAVING = 'saving'
const SAVE_SAVED = 'saved'
const SAVE_FAILED = 'failed'
const NOTE_FONT_MIN = 12
const NOTE_FONT_MAX = 24
const NOTE_FONT_DEFAULT = 14
const DRAWER_STATE_KEY = 'mototrace_notes_drawer_state_v1'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })
const notePath = (id) => `notes/${id}.json`

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

function generateId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function normalizeFontSize(value) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? clamp(parsed, NOTE_FONT_MIN, NOTE_FONT_MAX) : NOTE_FONT_DEFAULT
}

function isValidDateString(value) {
  if (!DATE_RE.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
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

function extractText(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    try {
      return extractText(JSON.parse(value))
    } catch {
      return value
    }
  }
  if (Array.isArray(value.content)) return value.content.map(extractText).join('')
  if (value.type === 'text') return value.text || ''
  return ''
}

function compareNotes(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
}

function compareLatest(a, b) {
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
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

function isLinkedToDate(note, dateStr) {
  const dateLink = normalizeDateLink(note.dateLink)
  return Boolean(dateLink && dateLink.start <= dateStr && dateLink.end >= dateStr)
}

function readDrawerState(dateStr) {
  try {
    const parsed = JSON.parse(window.sessionStorage?.getItem(DRAWER_STATE_KEY) || '{}')
    return parsed?.[dateStr] || null
  } catch {
    return null
  }
}

function writeDrawerState(dateStr, patch) {
  try {
    const parsed = JSON.parse(window.sessionStorage?.getItem(DRAWER_STATE_KEY) || '{}')
    parsed[dateStr] = {
      ...(parsed[dateStr] || {}),
      ...patch
    }
    window.sessionStorage?.setItem(DRAWER_STATE_KEY, JSON.stringify(parsed))
  } catch {
    // State memory is a convenience feature; ignore storage failures.
  }
}

function forgetDrawerSelected(dateStr) {
  writeDrawerState(dateStr, { selectedId: null })
}

function getDrawerVisibleNotes(notes, { mode, dateStr, query, selectedId }) {
  const q = query.trim().toLowerCase()
  return notes
    .filter(note => !note.archived || note.id === selectedId)
    .filter(note => {
      if (note.id === selectedId) return true
      if (mode === 'linked') return isLinkedToDate(note, dateStr)
      if (mode === 'pinned') return note.pinned
      return true
    })
    .filter(note => {
      if (note.id === selectedId) return true
      if (!q) return true
      return `${note.title} ${extractText(note.content)}`.toLowerCase().includes(q)
    })
    .sort(mode === 'latest' ? compareLatest : compareNotes)
}

export default function NotesDrawer({ dateStr, width, onResizeStart, closing = false, onAnimationEnd }) {
  const { showToast, confirm, registerPendingFlush, unregisterPendingFlush } = useApp()
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [currentNote, setCurrentNote] = useState(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('linked')
  const [saveStatus, setSaveStatus] = useState(SAVE_IDLE)
  const [loading, setLoading] = useState(true)
  const [refreshingDate, setRefreshingDate] = useState(false)
  const [viewDateStr, setViewDateStr] = useState(dateStr)
  const [viewOrder, setViewOrder] = useState([])
  const titleInputRef = useRef(null)
  const saveTimerRef = useRef(null)
  const pendingNoteRef = useRef(null)
  const hasLoadedRef = useRef(false)
  const loadSeqRef = useRef(0)

  const writeIndex = useCallback(async (nextNotes) => {
    return window.api.fs.writeFile(NOTES_INDEX_PATH, JSON.stringify(nextNotes.map(normalizeMeta), null, 2))
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
    setTimeout(() => setSaveStatus(SAVE_IDLE), 1400)
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
    const seq = loadSeqRef.current + 1
    loadSeqRef.current = seq
    const isInitialLoad = !hasLoadedRef.current
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setRefreshingDate(true)
    }

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
    if (loadSeqRef.current !== seq) return

    loaded.sort(compareNotes)
    const savedState = readDrawerState(dateStr)
    const savedMode = ['linked', 'pinned', 'latest'].includes(savedState?.mode) ? savedState.mode : 'linked'
    const restoredNote = savedState?.selectedId ? loaded.find(note => note.id === savedState.selectedId) : null
    const restoredSelectedId = restoredNote?.id || null
    if (savedState?.selectedId && !restoredNote) forgetDrawerSelected(dateStr)

    setNotes(loaded)
    setMode(savedMode)
    setSelectedId(restoredSelectedId)
    setCurrentNote(restoredNote || null)
    setViewDateStr(dateStr)
    setViewOrder(getDrawerVisibleNotes(loaded, {
      mode: savedMode,
      dateStr,
      query: '',
      selectedId: restoredSelectedId
    }).map(note => note.id))
    hasLoadedRef.current = true
    setLoading(false)
    setRefreshingDate(false)
  }, [dateStr, showToast])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    registerPendingFlush('notes-drawer', flushPending)
    return () => {
      const pending = pendingNoteRef.current
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      pendingNoteRef.current = null
      if (pending) {
        writeNote(pending.note)
          .then(() => writeIndex(pending.notes))
          .catch(error => console.error('Failed to flush notes drawer on unmount:', error))
      }
      unregisterPendingFlush('notes-drawer')
    }
  }, [flushPending, registerPendingFlush, unregisterPendingFlush, writeIndex, writeNote])

  const sortedFilteredNotes = useMemo(() => {
    return getDrawerVisibleNotes(notes, { mode, dateStr: viewDateStr, query, selectedId })
  }, [mode, notes, query, selectedId, viewDateStr])

  const filteredNotes = useMemo(() => {
    if (viewOrder.length === 0) return sortedFilteredNotes
    const frozenIndex = new Map(viewOrder.map((id, index) => [id, index]))
    const liveIndex = new Map(sortedFilteredNotes.map((note, index) => [note.id, index]))
    return [...sortedFilteredNotes].sort((a, b) => {
      const aFrozen = frozenIndex.has(a.id)
      const bFrozen = frozenIndex.has(b.id)
      if (aFrozen && bFrozen) return frozenIndex.get(a.id) - frozenIndex.get(b.id)
      if (aFrozen) return -1
      if (bFrozen) return 1
      return liveIndex.get(a.id) - liveIndex.get(b.id)
    })
  }, [viewOrder, sortedFilteredNotes])

  const selectNote = useCallback(async (note) => {
    await flushPending()
    if (viewOrder.length === 0) {
      setViewOrder(getDrawerVisibleNotes(notes, { mode, dateStr: viewDateStr, query, selectedId: note.id }).map(item => item.id))
    }
    setSelectedId(note.id)
    setCurrentNote(note)
    setSaveStatus(SAVE_IDLE)
    writeDrawerState(viewDateStr, { mode, selectedId: note.id })
    setTimeout(() => titleInputRef.current?.focus(), 40)
  }, [flushPending, mode, notes, query, viewDateStr, viewOrder.length])

  const closeEditor = useCallback(async () => {
    await flushPending()
    setSelectedId(null)
    setCurrentNote(null)
    setSaveStatus(SAVE_IDLE)
    forgetDrawerSelected(viewDateStr)
  }, [flushPending, viewDateStr])

  const handleModeChange = useCallback(async (nextMode) => {
    await closeEditor()
    setMode(nextMode)
    setViewOrder(getDrawerVisibleNotes(notes, { mode: nextMode, dateStr: viewDateStr, query, selectedId: null }).map(note => note.id))
    writeDrawerState(viewDateStr, { mode: nextMode, selectedId: null })
  }, [closeEditor, notes, query, viewDateStr])

  const updateCurrentNote = useCallback((patch) => {
    if (!currentNote) return
    const updatedAt = new Date().toISOString()
    const nextNote = {
      ...currentNote,
      ...patch,
      updatedAt,
      dateLink: patch.dateLink !== undefined ? normalizeDateLink(patch.dateLink) : normalizeDateLink(currentNote.dateLink)
    }
    const nextNotes = notes.map(note => note.id === nextNote.id ? { ...note, ...nextNote } : note).sort(compareNotes)
    setCurrentNote(nextNote)
    setNotes(nextNotes)
    scheduleSave(nextNote, nextNotes)
  }, [currentNote, notes, scheduleSave])

  const updateFontSize = useCallback((size) => {
    const nextSize = normalizeFontSize(size)
    localStorage.setItem('mototrace_notes_font_size', String(nextSize))
    updateCurrentNote({ fontSize: nextSize })
  }, [updateCurrentNote])

  const createNote = useCallback(async () => {
    await flushPending()
    const now = new Date().toISOString()
    const note = {
      id: generateId(),
      title: '',
      content: emptyDoc(),
      createdAt: now,
      updatedAt: now,
      pinned: mode === 'pinned',
      archived: false,
      fontSize: normalizeFontSize(localStorage.getItem('mototrace_notes_font_size')),
      dateLink: mode === 'linked' ? { type: 'single', start: viewDateStr, end: viewDateStr } : null
    }
    const nextNotes = [note, ...notes].sort(compareNotes)
    setNotes(nextNotes)
    setSelectedId(note.id)
    setCurrentNote(note)
    setViewOrder(getDrawerVisibleNotes(nextNotes, { mode, dateStr: viewDateStr, query, selectedId: note.id }).map(item => item.id))
    writeDrawerState(viewDateStr, { mode, selectedId: note.id })
    const ok = await persistNoteNow(note, nextNotes)
    if (ok) setTimeout(() => titleInputRef.current?.focus(), 40)
  }, [flushPending, mode, notes, persistNoteNow, query, viewDateStr])

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
    setSelectedId(duplicate.id)
    setCurrentNote(duplicate)
    setSaveStatus(SAVE_IDLE)
    setViewOrder(getDrawerVisibleNotes(nextNotes, {
      mode,
      dateStr: viewDateStr,
      query,
      selectedId: duplicate.id
    }).map(note => note.id))
    writeDrawerState(viewDateStr, { mode, selectedId: duplicate.id })

    const ok = await persistNoteNow(duplicate, nextNotes)
    if (ok) {
      showToast('已新建便签副本', 'success', 1200)
      setTimeout(() => titleInputRef.current?.focus(), 40)
    }
  }, [flushPending, mode, notes, persistNoteNow, query, showToast, viewDateStr])


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

    const nextSelectedId = selectedId === noteId ? null : selectedId
    const nextCurrentNote = currentNote?.id === noteId ? null : currentNote
    setNotes(nextNotes)
    setSelectedId(nextSelectedId)
    setCurrentNote(nextCurrentNote)
    setSaveStatus(SAVE_IDLE)
    setViewOrder(getDrawerVisibleNotes(nextNotes, {
      mode,
      dateStr: viewDateStr,
      query,
      selectedId: nextSelectedId
    }).map(note => note.id))
    if (selectedId === noteId) forgetDrawerSelected(viewDateStr)
    showToast('便签已删除', 'success', 1200)
  }, [confirm, currentNote, flushPending, mode, notes, query, selectedId, showToast, viewDateStr, writeIndex])

  useContextMenuCommand('notes-drawer-list', useCallback((id, context) => {
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
    if (id === 'delete') {
      deleteNoteById(note.id)
    }
  }, [createNote, deleteNoteById, duplicateNoteById, notes]))

  const handleNoteContextMenu = useCallback((event, note) => {
    if (isEditableMenuTarget(event.target)) return

    showContextMenu(event, [
      { id: 'new', label: '新建' },
      { id: 'duplicate', label: '新建副本' },
      separator,
      { id: 'delete', label: '删除', tone: 'danger' }
    ], {
      scope: 'notes-drawer-list',
      noteId: note.id
    })
  }, [])

  const handleListBlankContextMenu = useCallback((event) => {
    if (event.target !== event.currentTarget && !event.target.closest?.('.notes-drawer-empty')) return
    showContextMenu(event, [
      { id: 'new', label: '新建' }
    ], {
      scope: 'notes-drawer-list'
    })
  }, [])

  const activeFontSize = normalizeFontSize(currentNote?.fontSize)

  return (
    <aside
      className={`notes-drawer ${closing ? 'is-closing' : ''}`}
      style={{ width, '--notes-drawer-width': `${width}px`, '--notes-drawer-offset': `-${width}px` }}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget) onAnimationEnd?.()
      }}
    >
      <div className="notes-drawer-resize" onMouseDown={onResizeStart} title="拖动调整便签抽屉宽度" />
      <div className="notes-drawer-header">
        <div className="notes-drawer-heading">
          <h2>便签</h2>
          <span>{filteredNotes.length} 条</span>
        </div>
        <button className="notes-drawer-new" onClick={createNote} title="新建便签" disabled={refreshingDate}>+</button>
      </div>

      <div className="notes-drawer-search search-wrap">
        <span className="search-icon">⌕</span>
        <input className="input search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索便签" />
        {query && <button className="notes-drawer-clear" onClick={() => setQuery('')} title="清空搜索">×</button>}
      </div>

      <div className="notes-drawer-tabs">
        <button className={mode === 'linked' ? 'active' : ''} onClick={() => handleModeChange('linked')}>关联</button>
        <button className={mode === 'pinned' ? 'active' : ''} onClick={() => handleModeChange('pinned')}>置顶</button>
        <button className={mode === 'latest' ? 'active' : ''} onClick={() => handleModeChange('latest')}>最新</button>
      </div>

      <div
        className={`notes-drawer-list ${refreshingDate ? 'is-refreshing-date' : ''}`}
        onContextMenu={handleListBlankContextMenu}
      >
        {loading ? (
          <>
            <div className="notes-drawer-skeleton skeleton" />
            <div className="notes-drawer-skeleton skeleton" />
          </>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-drawer-empty">暂无便签</div>
        ) : (
          filteredNotes.map(note => (
            selectedId === note.id && currentNote?.id === note.id ? (
              <article
                key={note.id}
                className="notes-drawer-card active editing"
                onContextMenu={(event) => handleNoteContextMenu(event, note)}
              >
                <div className="notes-drawer-edit-header">
                  <input
                    ref={titleInputRef}
                    className="notes-drawer-title-input selectable"
                    value={currentNote.title}
                    onChange={e => updateCurrentNote({ title: e.target.value })}
                    placeholder="无标题便签"
                  />
                  <button className="notes-drawer-close-edit" onClick={closeEditor} title="收起编辑">
                    收起
                  </button>
                </div>
                <div className="notes-drawer-edit-subbar">
                  <div className="notes-drawer-editor-meta">
                    <span>{formatTime(currentNote.updatedAt)}</span>
                    <SaveStatusBadge status={saveStatus} compact />
                  </div>
                  <div className="notes-drawer-font">
                    <button onClick={() => updateFontSize(activeFontSize - 1)} title="缩小字体">A-</button>
                    <span>{activeFontSize}</span>
                    <button onClick={() => updateFontSize(activeFontSize + 1)} title="放大字体">A+</button>
                  </div>
                </div>
                <div className="notes-drawer-editor-body">
                  <TiptapEditor
                    value={currentNote.content || emptyDoc()}
                    onChange={(content) => updateCurrentNote({ content })}
                    placeholder="写下长期计划、灵感或临时素材..."
                    onSave={flushPending}
                    fontSize={activeFontSize}
                    onFontSizeChange={updateFontSize}
                  />
                </div>
              </article>
            ) : (
              <button
                key={note.id}
                className="notes-drawer-card"
                onClick={() => selectNote(note)}
                onContextMenu={(event) => handleNoteContextMenu(event, note)}
                title="点击编辑便签"
              >
                <span className="notes-drawer-card-title">{note.title?.trim() || '无标题便签'}</span>
                <span className="notes-drawer-card-text">{extractText(note.content) || '空白便签'}</span>
                <span className="notes-drawer-card-time">{formatTime(note.updatedAt)}</span>
              </button>
            )
          ))
        )}
      </div>
    </aside>
  )
}
