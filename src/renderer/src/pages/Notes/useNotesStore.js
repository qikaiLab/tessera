import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { createNoteOperationBarrier } from '../../utils/noteOperations'
import { loadNotesFromDisk } from '../../utils/noteStorage'
import {
  compareNotes,
  countNoteChars,
  createBlankNote,
  deleteNoteConfirmation,
  duplicateNote,
  editNote,
  notePath,
  replaceNote
} from '../../utils/notes'
import { NOTE_SAVE, useNotePersistence } from '../../utils/useNotePersistence'

const NOTES_FONT_SIZE_KEY = 'mototrace_notes_font_size'

/**
 * The notes page's data: the list, which note is open, and everything that changes them
 * (select, edit, create, duplicate, pin, archive, delete), saved through useNotePersistence.
 *
 * Switching, creating and deleting wait for pending edits to be written first, and a click right
 * after confirming a delete waits for the delete to reach the disk (the operation barrier).
 *
 * `onSelectionReset` runs whenever the open note changes, so the page can close what belongs to
 * the previous one (fullscreen, the date-link panel); `onFocusTitle` asks the page to focus the
 * title field of a note that was just created. `showArchived` decides which note opens next
 * after a delete.
 */
export function useNotesStore({ showArchived, onSelectionReset, onFocusTitle }) {
  const { showToast, confirm } = useApp()
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [currentNote, setCurrentNote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [charCount, setCharCount] = useState(0)
  const { saveStatus, setSaveStatus, persistNow, flushPending, scheduleSave } = useNotePersistence({
    flushKey: 'notes',
    savedBadgeMs: 1600
  })
  const operationsRef = useRef(null)
  if (!operationsRef.current) operationsRef.current = createNoteOperationBarrier()

  // The page's callbacks change every render; keep the store's own callbacks stable.
  const callbacksRef = useRef({})
  callbacksRef.current = { onSelectionReset, onFocusTitle }

  const open = useCallback((note) => {
    setSelectedId(note?.id || null)
    setCurrentNote(note || null)
    setCharCount(note ? countNoteChars(note.content) : 0)
    callbacksRef.current.onSelectionReset?.()
  }, [])

  const loadNotes = useCallback(async () => {
    setLoading(true)
    const loaded = await loadNotesFromDisk({
      onIndexCorrupt: () => showToast('便签索引已损坏，正在根据便签文件重新建立', 'error')
    })
    setNotes(loaded)
    open(loaded.find(note => !note.archived) || loaded[0] || null)
    setLoading(false)
  }, [open, showToast])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const selectNote = useCallback(async (note) => {
    await operationsRef.current.wait()
    if (!await flushPending()) return
    open(note)
    setSaveStatus(NOTE_SAVE.IDLE)
  }, [flushPending, open, setSaveStatus])

  const updateCurrentNote = useCallback((patch) => {
    if (!currentNote || operationsRef.current.busy()) return
    const nextNote = editNote(currentNote, patch)
    const nextNotes = replaceNote(notes, nextNote)
    setCurrentNote(nextNote)
    setNotes(nextNotes)
    scheduleSave(nextNote, nextNotes)
  }, [currentNote, notes, scheduleSave])

  const focusTitleSoon = useCallback(() => setTimeout(() => callbacksRef.current.onFocusTitle?.(), 40), [])

  const createNote = useCallback(async () => {
    await operationsRef.current.wait()
    if (!await flushPending()) return
    const note = createBlankNote({ fontSize: localStorage.getItem(NOTES_FONT_SIZE_KEY) })
    const nextNotes = [note, ...notes].sort(compareNotes)
    setNotes(nextNotes)
    setCurrentNote(note)
    setSelectedId(note.id)
    if (await persistNow(note, nextNotes)) {
      showToast('已新建便签', 'success', 1200)
      setCharCount(0)
      focusTitleSoon()
    }
  }, [flushPending, focusTitleSoon, notes, persistNow, showToast])

  const duplicateNoteById = useCallback(async (noteId) => {
    await operationsRef.current.wait()
    const source = notes.find(note => note.id === noteId)
    if (!source) return
    if (!await flushPending()) return

    const duplicate = duplicateNote(source)
    const nextNotes = [duplicate, ...notes].sort(compareNotes)
    setNotes(nextNotes)
    open(duplicate)
    if (await persistNow(duplicate, nextNotes)) {
      showToast('已新建便签副本', 'success', 1200)
      focusTitleSoon()
    }
  }, [flushPending, focusTitleSoon, notes, open, persistNow, showToast])

  // Pin / archive any note in the list (not only the open one): saved at once.
  const changeNoteById = useCallback(async (noteId, makePatch) => {
    const target = notes.find(note => note.id === noteId)
    if (!target) return
    if (!await flushPending()) return
    const nextNote = editNote(target, makePatch(target))
    const nextNotes = replaceNote(notes, nextNote)
    setNotes(nextNotes)
    if (currentNote?.id === noteId) setCurrentNote(nextNote)
    await persistNow(nextNote, nextNotes)
  }, [currentNote, flushPending, notes, persistNow])

  const togglePinnedById = useCallback(
    (noteId) => changeNoteById(noteId, note => ({ pinned: !note.pinned })),
    [changeNoteById]
  )

  // Archiving also unpins; restoring keeps the pin the note had.
  const toggleArchivedById = useCallback(
    (noteId) => changeNoteById(noteId, note => ({
      archived: !note.archived,
      pinned: note.archived ? note.pinned : false
    })),
    [changeNoteById]
  )

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

      // Deleting the open note opens the next one of the list being viewed.
      const nextOpen = currentNote?.id === noteId
        ? (nextNotes.find(note => (showArchived ? note.archived : !note.archived)) || nextNotes[0] || null)
        : currentNote
      setNotes(nextNotes)
      open(nextOpen)
      setSaveStatus(NOTE_SAVE.IDLE)
      showToast('便签已删除', 'success', 1200)
    })
  }, [confirm, currentNote, flushPending, notes, open, setSaveStatus, showArchived, showToast])

  return {
    notes,
    selectedId,
    currentNote,
    loading,
    saveStatus,
    charCount,
    setCharCount,
    flushPending,
    loadNotes,
    selectNote,
    updateCurrentNote,
    createNote,
    duplicateNoteById,
    togglePinnedById,
    toggleArchivedById,
    deleteNoteById
  }
}
