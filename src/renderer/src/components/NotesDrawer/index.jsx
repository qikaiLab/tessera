import { Fragment, useCallback, useRef } from 'react'
import { separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'
import { isEditableMenuTarget } from '../../utils/editableText'
import { useSlidingThumb } from '../../utils/useSlidingThumb'
import DrawerNoteItem from './DrawerNoteItem'
import { useDrawerNotes } from './useDrawerNotes'
import './NotesDrawer.css'

const TABS = [
  { mode: 'linked', label: '关联' },
  { mode: 'pinned', label: '置顶' },
  { mode: 'latest', label: '最新' }
]

// The right-click menus of the drawer's notes.
function useDrawerContextMenu(drawer) {
  const { notes, createNote, duplicateNoteById, deleteNoteById } = drawer

  useContextMenuCommand('notes-drawer-list', useCallback((id, context) => {
    if (id === 'new') {
      createNote()
      return
    }
    const note = context?.noteId ? notes.find(item => item.id === context.noteId) : null
    if (!note) return
    if (id === 'duplicate') duplicateNoteById(note.id)
    else if (id === 'delete') deleteNoteById(note.id)
  }, [createNote, deleteNoteById, duplicateNoteById, notes]))

  const openNoteMenu = useCallback((event, note) => {
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

  const openBlankMenu = useCallback((event) => {
    if (event.target !== event.currentTarget && !event.target.closest?.('.notes-drawer-empty')) return
    showContextMenu(event, [{ id: 'new', label: '新建' }], { scope: 'notes-drawer-list' })
  }, [])

  return { openNoteMenu, openBlankMenu }
}

/**
 * The notes beside the day's records: notes linked to the day, pinned notes, or the latest
 * ones, each opening in place for quick edits.
 */
export default function NotesDrawer({ dateStr, width, onResizeStart, closing = false, suspended = false, onAnimationEnd }) {
  const modeThumbRef = useSlidingThumb()
  const titleInputRef = useRef(null)
  const drawer = useDrawerNotes({ dateStr, onFocusTitle: () => titleInputRef.current?.focus() })
  const menu = useDrawerContextMenu(drawer)
  const { filteredNotes, query, setQuery, mode, loading, refreshingDate, selectedId, currentNote } = drawer

  return (
    <aside
      className={`notes-drawer ${closing ? 'is-closing' : ''}`}
      // While a card is fullscreen the drawer waits underneath it and cannot take focus.
      inert={suspended ? '' : undefined}
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
        <button className="notes-drawer-new" onClick={drawer.createNote} title="新建便签" disabled={refreshingDate}>+</button>
      </div>

      <div className="notes-drawer-search search-wrap">
        <span className="search-icon">⌕</span>
        <input className="input search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索便签" />
        {query && <button className="notes-drawer-clear" onClick={() => setQuery('')} title="清空搜索">×</button>}
      </div>

      <div className="notes-drawer-tabs" ref={modeThumbRef}>
        {TABS.map(tab => (
          <button
            key={tab.mode}
            className={mode === tab.mode ? 'active' : ''}
            onClick={() => drawer.changeMode(tab.mode)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`notes-drawer-list ${refreshingDate ? 'is-refreshing-date' : ''}`}
        onContextMenu={menu.openBlankMenu}
      >
        {loading ? (
          <>
            <div className="notes-drawer-skeleton skeleton" />
            <div className="notes-drawer-skeleton skeleton" />
          </>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-drawer-empty">暂无便签</div>
        ) : (
          <Fragment key={mode}>
            {filteredNotes.map((note, index) => (
              <DrawerNoteItem
                key={note.id}
                note={note}
                index={index}
                editing={selectedId === note.id && currentNote?.id === note.id}
                titleInputRef={titleInputRef}
                drawer={drawer}
                onContextMenu={menu.openNoteMenu}
              />
            ))}
          </Fragment>
        )}
      </div>
    </aside>
  )
}
