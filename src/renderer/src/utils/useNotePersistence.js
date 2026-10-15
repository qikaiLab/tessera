import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { NOTES_INDEX_PATH, normalizeNoteMeta, notePath, serializeNote } from './notes'

export const NOTE_SAVE = {
  IDLE: 'idle',
  UNSAVED: 'unsaved',
  SAVING: 'saving',
  SAVED: 'saved',
  FAILED: 'failed'
}

const SAVE_DEBOUNCE_MS = 800

const writeNote = (note) => window.api.fs.writeFile(notePath(note.id), serializeNote(note))

const writeIndex = (notes) => window.api.fs.writeFile(
  NOTES_INDEX_PATH,
  JSON.stringify(notes.map(normalizeNoteMeta), null, 2)
)

/**
 * Saving notes: a note file and the index that lists it, debounced while typing, flushed on
 * demand (before switching notes, on a save shortcut) and before the window closes or the owner
 * unmounts. `flushKey` names this owner in the app's shutdown flush.
 */
export function useNotePersistence({ flushKey, savedBadgeMs = 1600 }) {
  const { showToast, registerPendingFlush, unregisterPendingFlush } = useApp()
  const [saveStatus, setSaveStatus] = useState(NOTE_SAVE.IDLE)
  const saveTimerRef = useRef(null)
  const pendingRef = useRef(null)

  // Writes the note, then the index; false (and a failed status) when either write fails.
  const persistNow = useCallback(async (note, notes) => {
    setSaveStatus(NOTE_SAVE.SAVING)
    const noteResult = await writeNote(note)
    if (!noteResult.ok) {
      setSaveStatus(NOTE_SAVE.FAILED)
      showToast('便签保存失败', 'error')
      return false
    }
    const indexResult = await writeIndex(notes)
    if (!indexResult.ok) {
      setSaveStatus(NOTE_SAVE.FAILED)
      showToast('便签索引保存失败', 'error')
      return false
    }
    setSaveStatus(NOTE_SAVE.SAVED)
    setTimeout(() => setSaveStatus(NOTE_SAVE.IDLE), savedBadgeMs)
    return true
  }, [savedBadgeMs, showToast])

  const savePending = useCallback(async () => {
    const pending = pendingRef.current
    if (!pending) return true
    const saved = await persistNow(pending.note, pending.notes)
    if (saved && pendingRef.current === pending) pendingRef.current = null
    return saved
  }, [persistNow])

  // Saves anything pending right now; false if that fails, so callers do not move on.
  const flushPending = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    return savePending()
  }, [savePending])

  const scheduleSave = useCallback((note, notes) => {
    pendingRef.current = { note, notes }
    setSaveStatus(NOTE_SAVE.UNSAVED)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      savePending()
    }, SAVE_DEBOUNCE_MS)
  }, [savePending])

  useEffect(() => {
    registerPendingFlush(flushKey, flushPending)
    return () => {
      // Leaving with an unsaved edit: write it instead of dropping it.
      const pending = pendingRef.current
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      pendingRef.current = null
      if (pending) {
        writeNote(pending.note)
          .then(() => writeIndex(pending.notes))
          .catch(error => console.error('Failed to flush notes on unmount:', error))
      }
      unregisterPendingFlush(flushKey)
    }
  }, [flushKey, flushPending, registerPendingFlush, unregisterPendingFlush])

  return { saveStatus, setSaveStatus, persistNow, flushPending, scheduleSave }
}
