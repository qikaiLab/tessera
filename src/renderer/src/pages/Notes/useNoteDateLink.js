import { useCallback, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { dateLinkToDraft, isValidDateString, normalizeDateLink } from '../../utils/notes'

/**
 * Linking the open note to a day or a range of days: the panel, its form state and its
 * save / clear actions. `selectNote` is used to open the panel for a note chosen in the list.
 */
export function useNoteDateLink({ notes, currentNote, updateCurrentNote, selectNote }) {
  const { showToast } = useApp()
  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState(() => dateLinkToDraft(null))

  const closePanel = useCallback(() => setPanelOpen(false), [])

  const togglePanel = () => {
    if (!currentNote) return
    setDraft(dateLinkToDraft(currentNote.dateLink))
    setPanelOpen(open => !open)
  }

  const openPanelForNote = useCallback(async (noteId) => {
    const note = notes.find(item => item.id === noteId)
    if (!note) return
    await selectNote(note)
    setDraft(dateLinkToDraft(note.dateLink))
    setPanelOpen(true)
  }, [notes, selectNote])

  const clear = () => {
    updateCurrentNote({ dateLink: null })
    setDraft(dateLinkToDraft(null))
    setPanelOpen(false)
    showToast('已清除关联日期', 'success', 1200)
  }

  const save = () => {
    if (draft.type === 'none') {
      clear()
      return
    }

    const start = draft.start
    const end = draft.type === 'single' ? draft.start : draft.end
    if (!isValidDateString(start) || !isValidDateString(end)) {
      showToast('请选择有效日期', 'error')
      return
    }
    if (start > end) {
      showToast('结束日期不能早于开始日期', 'error')
      return
    }

    const dateLink = normalizeDateLink({ type: draft.type, start, end })
    updateCurrentNote({ dateLink })
    setDraft(dateLinkToDraft(dateLink))
    setPanelOpen(false)
    showToast('已更新关联日期', 'success', 1200)
  }

  return { panelOpen, draft, setDraft, closePanel, togglePanel, openPanelForNote, clear, save }
}
