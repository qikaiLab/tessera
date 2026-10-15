import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { createNoteOperationBarrier } from '../../utils/noteOperations'
import { loadNotesFromDisk } from '../../utils/noteStorage'
import {
  compareNotes,
  createBlankNote,
  deleteNoteConfirmation,
  duplicateNote,
  editNote,
  normalizeNoteFontSize,
  notePath,
  replaceNote
} from '../../utils/notes'
import { NOTE_SAVE, useNotePersistence } from '../../utils/useNotePersistence'
import {
  DRAWER_MODES,
  forgetDrawerSelected,
  getDrawerVisibleNotes,
  readDrawerState,
  writeDrawerState
} from './drawerState'

const NOTES_FONT_SIZE_KEY = 'mototrace_notes_font_size'
// The editor opens with its card animation; focus the title once it has.
const TITLE_FOCUS_DELAY_MS = 110

const orderOf = (list, options) => getDrawerVisibleNotes(list, options).map(note => note.id)

/**
 * The notes drawer's data for one day: the notes of a tab (linked / pinned / latest), the open
 * note and everything that changes them, saved through useNotePersistence.
 *
 * The list keeps the order it was opened with (`viewOrder`) so a note does not jump to the top
 * of the list while it is being edited; the order is recomputed when the tab, the day or the
 * open note changes.
 */
export function useDrawerNotes({ dateStr, onFocusTitle }) {
  const { showToast, confirm } = useApp()
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [currentNote, setCurrentNote] = useState(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('linked')
  const [loading, setLoading] = useState(true)
  const [refreshingDate, setRefreshingDate] = useState(false)
  const [viewDateStr, setViewDateStr] = useState(dateStr)
  const [viewOrder, setViewOrder] = useState([])
  const { saveStatus, setSaveStatus, persistNow, flushPending, scheduleSave } = useNotePersistence({
    flushKey: 'notes-drawer',
    savedBadgeMs: 1400
  })
  const operationsRef = useRef(null)
  if (!operationsRef.current) operationsRef.current = createNoteOperationBarrier()
  const hasLoadedRef = useRef(false)
  const loadSeqRef = useRef(0)
  const onFocusTitleRef = useRef(onFocusTitle)
  onFocusTitleRef.current = onFocusTitle

  const focusTitleSoon = useCallback(() => setTimeout(() => onFocusTitleRef.current?.(), TITLE_FOCUS_DELAY_MS), [])

  const loadNotes = useCallback(async () => {
    const seq = loadSeqRef.current + 1
    loadSeqRef.current = seq
    if (hasLoadedRef.current) setRefreshingDate(true)
    else setLoading(true)

    const loaded = await loadNotesFromDisk({
      onIndexCorrupt: () => showToast('便签索引已损坏，正在根据便签文件重新建立', 'error')
    })
    if (loadSeqRef.current !== seq) return

    const savedState = readDrawerState(dateStr)
    const savedMode = DRAWER_MODES.includes(savedState?.mode) ? savedState.mode : 'linked'
    const restoredNote = savedState?.selectedId ? loaded.find(note => note.id === savedState.selectedId) : null
    const restoredSelectedId = restoredNote?.id || null
    if (savedState?.selectedId && !restoredNote) forgetDrawerSelected(dateStr)

    setNotes(loaded)
    setMode(savedMode)
    setSelectedId(restoredSelectedId)
    setCurrentNote(restoredNote || null)
    setViewDateStr(dateStr)
    setViewOrder(orderOf(loaded, { mode: savedMode, dateStr, query: '', selectedId: restoredSelectedId }))
    hasLoadedRef.current = true
    setLoading(false)
    setRefreshingDate(false)
  }, [dateStr, showToast])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const sortedFilteredNotes = useMemo(
    () => getDrawerVisibleNotes(notes, { mode, dateStr: viewDateStr, query, selectedId }),
    [mode, notes, query, selectedId, viewDateStr]
  )

  // The tab's notes in the frozen order; notes that appeared since (a new one) come after.
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
    await operationsRef.current.wait()
    if (!await flushPending()) return
    if (viewOrder.length === 0) {
      setViewOrder(orderOf(notes, { mode, dateStr: viewDateStr, query, selectedId: note.id }))
    }
    setSelectedId(note.id)
    setCurrentNote(note)
    setSaveStatus(NOTE_SAVE.IDLE)
    writeDrawerState(viewDateStr, { mode, selectedId: note.id })
    focusTitleSoon()
  }, [flushPending, focusTitleSoon, mode, notes, query, setSaveStatus, viewDateStr, viewOrder.length])

  const closeEditor = useCallback(async () => {
    if (!await flushPending()) return
    setSelectedId(null)
    setCurrentNote(null)
    setSaveStatus(NOTE_SAVE.IDLE)
    forgetDrawerSelected(viewDateStr)
  }, [flushPending, setSaveStatus, viewDateStr])

  const changeMode = useCallback(async (nextMode) => {
    await closeEditor()
    setMode(nextMode)
    setViewOrder(orderOf(notes, { mode: nextMode, dateStr: viewDateStr, query, selectedId: null }))
    writeDrawerState(viewDateStr, { mode: nextMode, selectedId: null })
  }, [closeEditor, notes, query, viewDateStr])

  const updateCurrentNote = useCallback((patch) => {
    if (!currentNote || operationsRef.current.busy()) return
    const nextNote = editNote(currentNote, patch)
    const nextNotes = replaceNote(notes, nextNote)
    setCurrentNote(nextNote)
    setNotes(nextNotes)
    scheduleSave(nextNote, nextNotes)
  }, [currentNote, notes, scheduleSave])

  const updateFontSize = useCallback((size) => {
    const nextSize = normalizeNoteFontSize(size)
    localStorage.setItem(NOTES_FONT_SIZE_KEY, String(nextSize))
    updateCurrentNote({ fontSize: nextSize })
  }, [updateCurrentNote])

  // A note created in a tab belongs there: pinned in "pinned", linked to the day in "linked".
  const createNote = useCallback(async () => {
    await operationsRef.current.wait()
    if (!await flushPending()) return
    const note = createBlankNote({
      pinned: mode === 'pinned',
      dateLink: mode === 'linked' ? { type: 'single', start: viewDateStr, end: viewDateStr } : null,
      fontSize: localStorage.getItem(NOTES_FONT_SIZE_KEY)
    })
    const nextNotes = [note, ...notes].sort(compareNotes)
    setNotes(nextNotes)
    setSelectedId(note.id)
    setCurrentNote(note)
    setViewOrder(orderOf(nextNotes, { mode, dateStr: viewDateStr, query, selectedId: note.id }))
    writeDrawerState(viewDateStr, { mode, selectedId: note.id })
    if (await persistNow(note, nextNotes)) focusTitleSoon()
  }, [flushPending, focusTitleSoon, mode, notes, persistNow, query, viewDateStr])

  const duplicateNoteById = useCallback(async (noteId) => {
    await operationsRef.current.wait()
    const source = notes.find(note => note.id === noteId)
    if (!source) return
    if (!await flushPending()) return

    const duplicate = duplicateNote(source)
    const nextNotes = [duplicate, ...notes].sort(compareNotes)
    setNotes(nextNotes)
    setSelectedId(duplicate.id)
    setCurrentNote(duplicate)
    setSaveStatus(NOTE_SAVE.IDLE)
    setViewOrder(orderOf(nextNotes, { mode, dateStr: viewDateStr, query, selectedId: duplicate.id }))
    writeDrawerState(viewDateStr, { mode, selectedId: duplicate.id })
    if (await persistNow(duplicate, nextNotes)) {
      showToast('已新建便签副本', 'success', 1200)
      focusTitleSoon()
    }
  }, [flushPending, focusTitleSoon, mode, notes, persistNow, query, setSaveStatus, showToast, viewDateStr])

  const deleteNoteById = useCallback(async (noteId) => {
    const target = notes.find(note => note.id === noteId)
    if (!target) return
    if (!await confirm(deleteNoteConfirmation(target))) return

    return operationsRef.current.run(async () => {
      if (!await flushPending()) return
      const nextNotes = notes.filter(note => note.id !== noteId).sort(compareNotes)
      const deleteResult = await window.api.fs.deleteFile(notePath(noteId))
      if (!deleteResult.ok) {
        showToast('便签文件删除失败', 'error')
        return
      }

      const nextSelectedId = selectedId === noteId ? null : selectedId
      setNotes(nextNotes)
      setSelectedId(nextSelectedId)
      setCurrentNote(currentNote?.id === noteId ? null : currentNote)
      setSaveStatus(NOTE_SAVE.IDLE)
      setViewOrder(orderOf(nextNotes, { mode, dateStr: viewDateStr, query, selectedId: nextSelectedId }))
      if (selectedId === noteId) forgetDrawerSelected(viewDateStr)
      showToast('便签已删除', 'success', 1200)
    })
  }, [confirm, currentNote, flushPending, mode, notes, query, selectedId, setSaveStatus, showToast, viewDateStr])

  return {
    notes,
    filteredNotes,
    selectedId,
    currentNote,
    query,
    setQuery,
    mode,
    changeMode,
    loading,
    refreshingDate,
    saveStatus,
    flushPending,
    selectNote,
    closeEditor,
    updateCurrentNote,
    updateFontSize,
    createNote,
    duplicateNoteById,
    deleteNoteById
  }
}
