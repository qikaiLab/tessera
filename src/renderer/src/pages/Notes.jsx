import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TiptapEditor from '../components/TiptapEditor'
import { useApp } from '../context/AppContext'
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function generateId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function emptyDoc() {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function notePath(id) {
  return `notes/${id}.json`
}

function normalizeMeta(note) {
  return {
    id: note.id,
    title: note.title?.trim() || '无标题便签',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    fontSize: normalizeFontSize(note.fontSize)
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
      fontSize: normalizeFontSize(parsed.fontSize ?? fallbackMeta.fontSize)
    }
  } catch {
    return null
  }
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
  const { showToast, registerPendingFlush, unregisterPendingFlush } = useApp()
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [currentNote, setCurrentNote] = useState(null)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [saveStatus, setSaveStatus] = useState(SAVE_IDLE)
  const [loading, setLoading] = useState(true)
  const [charCount, setCharCount] = useState(0)
  const [fullScreenNoteId, setFullScreenNoteId] = useState(null)
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
      fontSize: normalizeFontSize(note.fontSize)
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
    setSaveStatus(SAVE_IDLE)
  }, [flushPending])

  const updateCurrentNote = useCallback((patch) => {
    if (!currentNote) return
    const updatedAt = new Date().toISOString()
    const nextNote = {
      ...currentNote,
      ...patch,
      updatedAt
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
      fontSize: normalizeFontSize(localStorage.getItem('mototrace_notes_font_size'))
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

  const togglePinned = useCallback(() => {
    if (!currentNote) return
    updateCurrentNote({ pinned: !currentNote.pinned })
  }, [currentNote, updateCurrentNote])

  const toggleArchived = useCallback(() => {
    if (!currentNote) return
    updateCurrentNote({ archived: !currentNote.archived, pinned: currentNote.archived ? currentNote.pinned : false })
  }, [currentNote, updateCurrentNote])

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
      .sort(compareNotes)
  }, [notes, query, showArchived])

  const statusLabel = {
    [SAVE_IDLE]: null,
    [SAVE_SAVED]: { text: '已保存', cls: 'status-saved' },
    [SAVE_UNSAVED]: { text: '未保存', cls: 'status-unsaved' },
    [SAVE_SAVING]: { text: '保存中...', cls: 'status-saving' },
    [SAVE_FAILED]: { text: '保存失败', cls: 'status-failed' },
  }[saveStatus]
  const activeFontSize = normalizeFontSize(currentNote?.fontSize)

  return (
    <div className="notes-page" style={{ gridTemplateColumns: `${notesListWidth}px minmax(0, 1fr)` }}>
      <aside className="notes-list-panel">
        <div className="notes-list-header">
          <div>
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
          </div>
        </div>

        <div className="notes-filter-row tabs">
          <button className={`tab ${!showArchived ? 'active' : ''}`} onClick={() => setShowArchived(false)}>当前</button>
          <button className={`tab ${showArchived ? 'active' : ''}`} onClick={() => setShowArchived(true)}>归档</button>
        </div>

        <div className="notes-list">
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
              >
                <div className="notes-list-item-top">
                  <span className="notes-list-title">{note.title?.trim() || '无标题便签'}</span>
                  {note.pinned && <span className="notes-pin-dot">置顶</span>}
                </div>
                <p className="notes-list-snippet">{extractText(note.content) || '空白便签'}</p>
                <span className="notes-list-time">{formatTime(note.updatedAt)}</span>
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
                {statusLabel && (
                  <span className={`save-status ${statusLabel.cls}`}>
                    {saveStatus === SAVE_SAVING && <span className="status-dot saving" />}
                    {saveStatus === SAVE_SAVED && <span className="status-dot saved" />}
                    {saveStatus === SAVE_UNSAVED && <span className="status-dot unsaved" />}
                    {saveStatus === SAVE_FAILED && <span className="status-dot failed" />}
                    {statusLabel.text}
                  </span>
                )}
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
                  title="全屏记录"
                >
                  ⛶
                </button>
                <button className={`btn btn-ghost btn-sm ${currentNote.pinned ? 'notes-action-active' : ''}`} onClick={togglePinned}>
                  {currentNote.pinned ? '取消置顶' : '置顶'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={toggleArchived}>
                  {currentNote.archived ? '移出归档' : '归档'}
                </button>
              </div>
            </div>
            <div className="notes-editor-meta">
              <span>创建 {formatTime(currentNote.createdAt)}</span>
              <span>更新 {formatTime(currentNote.updatedAt)}</span>
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
