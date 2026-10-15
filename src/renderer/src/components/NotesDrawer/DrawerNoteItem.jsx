import Collapsible from '../Collapsible'
import SaveStatusBadge from '../SaveStatusBadge'
import TiptapEditor from '../TiptapEditor'
import { emptyDoc, extractNoteText, formatNoteTime, noteTitle, normalizeNoteFontSize } from '../../utils/notes'

// One note of the drawer. The compact card and the editing card trade places: one folds shut as
// the other opens.
export default function DrawerNoteItem({
  note,
  index,
  editing,
  titleInputRef,
  drawer,
  onContextMenu
}) {
  const { currentNote, saveStatus, selectNote, closeEditor, updateCurrentNote, updateFontSize, flushPending } = drawer
  const fontSize = normalizeNoteFontSize(currentNote?.fontSize)

  return (
    <div className="notes-drawer-item" style={{ '--enter-delay': `${Math.min(index, 6) * 40}ms` }}>
      <Collapsible open={!editing}>
        <button
          className="notes-drawer-card"
          onClick={() => selectNote(note)}
          onContextMenu={(event) => onContextMenu(event, note)}
          title="点击编辑便签"
        >
          <span className="notes-drawer-card-title">{noteTitle(note)}</span>
          <span className="notes-drawer-card-text">{extractNoteText(note.content) || '空白便签'}</span>
          <span className="notes-drawer-card-time">{formatNoteTime(note.updatedAt)}</span>
        </button>
      </Collapsible>
      <Collapsible open={editing}>
        {editing ? (
          <article
            className="notes-drawer-card active editing"
            onContextMenu={(event) => onContextMenu(event, note)}
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
                <span>{formatNoteTime(currentNote.updatedAt)}</span>
                <SaveStatusBadge status={saveStatus} compact />
              </div>
              <div className="notes-drawer-font">
                <button onClick={() => updateFontSize(fontSize - 1)} title="缩小字体">A-</button>
                <span>{fontSize}</span>
                <button onClick={() => updateFontSize(fontSize + 1)} title="放大字体">A+</button>
              </div>
            </div>
            <div className="notes-drawer-editor-body">
              <TiptapEditor
                key={currentNote.id}
                value={currentNote.content || emptyDoc()}
                onChange={(content) => updateCurrentNote({ content })}
                placeholder="写下长期计划、灵感或临时素材..."
                onSave={flushPending}
                fontSize={fontSize}
                onFontSizeChange={updateFontSize}
              />
            </div>
          </article>
        ) : null}
      </Collapsible>
    </div>
  )
}
