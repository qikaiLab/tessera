import { useMemo, useRef, useState } from 'react'
import AutomaticHistory from '../../components/AutomaticHistory'
import { EMPTY_DATE_FILTER, filterNotes, notePath } from '../../utils/notes'
import { useDelayedFlag } from '../../utils/useDelayedFlag'
import { useResizableWidth } from '../../utils/useResizableWidth'
import NoteEditorPanel from './NoteEditorPanel'
import NotesListPanel from './NotesListPanel'
import { useNoteDateLink } from './useNoteDateLink'
import { useNoteFullscreen } from './useNoteFullscreen'
import { useNotesContextMenu } from './useNotesContextMenu'
import { useNotesStore } from './useNotesStore'
import './Notes.css'

// The notes page: a list with search and filters on the left, the open note on the right. The
// state is split into hooks next to this file; this component only wires them together.
export default function Notes() {
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [dateFilter, setDateFilter] = useState(EMPTY_DATE_FILTER)
  const [historyOpen, setHistoryOpen] = useState(false)
  const titleInputRef = useRef(null)
  const list = useResizableWidth({ storageKey: 'mototrace_notes_list_width', min: 240, max: 520, initial: 320 })
  const fullscreen = useNoteFullscreen()

  // Whatever belongs to the previously open note (fullscreen, the date-link panel) closes when
  // another one opens. The link hook needs the store, so it is reached through a ref.
  const closeLinkPanelRef = useRef(() => {})
  const store = useNotesStore({
    showArchived,
    onSelectionReset: () => { fullscreen.close(); closeLinkPanelRef.current() },
    onFocusTitle: () => titleInputRef.current?.focus()
  })
  const link = useNoteDateLink(store)
  closeLinkPanelRef.current = link.closePanel
  const menu = useNotesContextMenu({
    notes: store.notes,
    actions: { ...store, openDateLinkPanelById: link.openPanelForNote }
  })

  // Only a slow load earns a skeleton; otherwise the page goes straight to its content.
  const showSkeleton = useDelayedFlag(store.loading, 240)
  const visibleNotes = useMemo(
    () => filterNotes(store.notes, { query, showArchived, dateFilter }),
    [store.notes, query, showArchived, dateFilter]
  )

  return (
    <div className="notes-page" style={{ gridTemplateColumns: `${list.width}px minmax(0, 1fr)` }}>
      <NotesListPanel
        notes={visibleNotes}
        loading={store.loading}
        showSkeleton={showSkeleton}
        selectedId={store.selectedId}
        query={query}
        onQueryChange={setQuery}
        showArchived={showArchived}
        onShowArchived={setShowArchived}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        onCreate={store.createNote}
        onSelect={store.selectNote}
        onNoteContextMenu={menu.openNoteMenu}
        onBlankContextMenu={menu.openBlankMenu}
      />
      <div
        className="notes-resize-handle"
        style={{ left: list.width - 3 }}
        onMouseDown={list.startResize}
        title="拖动调整便签列表宽度"
      />
      <NoteEditorPanel
        store={store}
        link={link}
        fullscreen={fullscreen}
        titleInputRef={titleInputRef}
        loading={store.loading}
        showSkeleton={showSkeleton}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      {historyOpen && store.currentNote && (
        <AutomaticHistory
          filePath={notePath(store.currentNote.id)}
          onClose={() => setHistoryOpen(false)}
          onRestore={store.loadNotes}
        />
      )}
    </div>
  )
}
