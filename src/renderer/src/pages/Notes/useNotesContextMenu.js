import { useCallback } from 'react'
import { separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'

/**
 * The right-click menus of the notes list: one for a note, one for the empty part of the list.
 * `actions` are the store's operations the menu items trigger.
 */
export function useNotesContextMenu({ notes, actions }) {
  const { createNote, duplicateNoteById, togglePinnedById, toggleArchivedById, openDateLinkPanelById, deleteNoteById } = actions

  useContextMenuCommand('notes-list', useCallback((id, context) => {
    if (id === 'new') {
      createNote()
      return
    }
    const note = context?.noteId ? notes.find(item => item.id === context.noteId) : null
    if (!note) return
    if (id === 'duplicate') duplicateNoteById(note.id)
    else if (id === 'toggle-pin') togglePinnedById(note.id)
    else if (id === 'toggle-archive') toggleArchivedById(note.id)
    else if (id === 'edit-date-link') openDateLinkPanelById(note.id)
    else if (id === 'delete') deleteNoteById(note.id)
  }, [createNote, deleteNoteById, duplicateNoteById, notes, openDateLinkPanelById, toggleArchivedById, togglePinnedById]))

  const openNoteMenu = useCallback((event, note) => {
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

  const openBlankMenu = useCallback((event) => {
    if (event.target !== event.currentTarget && !event.target.closest?.('.notes-empty-list')) return
    showContextMenu(event, [{ id: 'new', label: '新建' }], { scope: 'notes-list' })
  }, [])

  return { openNoteMenu, openBlankMenu }
}
