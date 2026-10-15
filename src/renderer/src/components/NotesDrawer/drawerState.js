import { compareLatest, compareNotes, isLinkedToDate, noteMatchesQuery } from '../../utils/notes'

export const DRAWER_MODES = ['linked', 'pinned', 'latest']

const DRAWER_STATE_KEY = 'mototrace_notes_drawer_state_v1'

// The drawer remembers, per day and for this session, which tab was open and which note.
export function readDrawerState(dateStr) {
  try {
    const parsed = JSON.parse(window.sessionStorage?.getItem(DRAWER_STATE_KEY) || '{}')
    return parsed?.[dateStr] || null
  } catch {
    return null
  }
}

export function writeDrawerState(dateStr, patch) {
  try {
    const parsed = JSON.parse(window.sessionStorage?.getItem(DRAWER_STATE_KEY) || '{}')
    parsed[dateStr] = { ...(parsed[dateStr] || {}), ...patch }
    window.sessionStorage?.setItem(DRAWER_STATE_KEY, JSON.stringify(parsed))
  } catch {
    // State memory is a convenience feature; ignore storage failures.
  }
}

export function forgetDrawerSelected(dateStr) {
  writeDrawerState(dateStr, { selectedId: null })
}

/**
 * The notes a drawer tab lists: "linked" (covering the day), "pinned" or "latest". The note that
 * is open always stays in the list, whatever the tab or search says, and archived notes only
 * show while open.
 */
export function getDrawerVisibleNotes(notes, { mode, dateStr, query, selectedId }) {
  return notes
    .filter(note => !note.archived || note.id === selectedId)
    .filter(note => {
      if (note.id === selectedId) return true
      if (mode === 'linked') return isLinkedToDate(note, dateStr)
      if (mode === 'pinned') return note.pinned
      return true
    })
    .filter(note => note.id === selectedId || noteMatchesQuery(note, query))
    .sort(mode === 'latest' ? compareLatest : compareNotes)
}
