import SaveStatusBadge from '../../components/SaveStatusBadge'
import TiptapEditor from '../../components/TiptapEditor'
import { FULLSCREEN_EDITOR_SHORTCUT_LABEL } from '../../utils/editorShortcuts'
import { emptyDoc, formatNoteTime, normalizeNoteFontSize } from '../../utils/notes'
import DateLinkPanel from './DateLinkPanel'
import './NoteEditorPanel.css'

const NOTES_FONT_SIZE_KEY = 'mototrace_notes_font_size'

function EditorSkeleton() {
  return (
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
  )
}

function NoEditor({ onCreate }) {
  return (
    <div className="notes-empty-editor">
      <div className="empty-state">
        <span className="empty-state-icon">N</span>
        <p className="empty-state-title">选择或新建一条便签</p>
        <p className="empty-state-desc">便签不会随日期切换，适合长期计划、灵感池和持续整理的资料。</p>
        <button className="btn btn-primary" onClick={onCreate}>新建便签</button>
      </div>
    </div>
  )
}

// The right column: the open note with its title, actions, meta line and editor.
export default function NoteEditorPanel({
  store,
  link,
  fullscreen,
  titleInputRef,
  loading,
  showSkeleton,
  onOpenHistory
}) {
  const { currentNote, saveStatus, charCount, setCharCount, updateCurrentNote, flushPending } = store
  const { show: fullscreenShown, leaving: fullscreenLeaving, toggle: toggleFullscreen } = fullscreen

  const activeFontSize = normalizeNoteFontSize(currentNote?.fontSize)

  const changeFontSize = (size) => {
    const nextSize = normalizeNoteFontSize(size)
    localStorage.setItem(NOTES_FONT_SIZE_KEY, String(nextSize))
    updateCurrentNote({ fontSize: nextSize })
  }

  const toggleArchived = () => updateCurrentNote({
    archived: !currentNote.archived,
    pinned: currentNote.archived ? currentNote.pinned : false
  })

  const renderBody = () => {
    if (loading) return showSkeleton && <EditorSkeleton />
    if (!currentNote) return <NoEditor onCreate={store.createNote} />
    return (
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
            <SaveStatusBadge status={saveStatus} />
            <button className="btn btn-ghost btn-sm" onClick={async () => { if (await flushPending()) onOpenHistory() }}>历史</button>
            <div className="card-font-controls">
              <button
                className="btn btn-ghost btn-xs font-ctrl-btn"
                onClick={() => changeFontSize(activeFontSize - 1)}
                title="缩小字体"
              >
                A-
              </button>
              <span className="font-ctrl-label">{activeFontSize}</span>
              <button
                className="btn btn-ghost btn-xs font-ctrl-btn"
                onClick={() => changeFontSize(activeFontSize + 1)}
                title="放大字体"
              >
                A+
              </button>
            </div>
            <button
              className="btn btn-ghost btn-xs btn-icon fullscreen-btn"
              onClick={() => toggleFullscreen(currentNote.id)}
              title={`全屏编辑 (${FULLSCREEN_EDITOR_SHORTCUT_LABEL})`}
              aria-label={`进入全屏编辑，快捷键 ${FULLSCREEN_EDITOR_SHORTCUT_LABEL}`}
            >
              ⛶
            </button>
            <span className="notes-actions-sep" aria-hidden="true" />
            <button
              className={`btn btn-ghost btn-sm ${currentNote.pinned ? 'notes-action-active' : ''}`}
              onClick={() => updateCurrentNote({ pinned: !currentNote.pinned })}
            >
              {currentNote.pinned ? '取消置顶' : '置顶'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={toggleArchived}>
              {currentNote.archived ? '移出归档' : '归档'}
            </button>
            <button className="btn btn-ghost btn-sm notes-delete-btn" onClick={() => store.deleteNoteById(currentNote.id)}>
              删除
            </button>
          </div>
        </div>
        <div className="notes-editor-meta">
          <span>创建 {formatNoteTime(currentNote.createdAt)}</span>
          <span>更新 {formatNoteTime(currentNote.updatedAt)}</span>
          <DateLinkPanel note={currentNote} link={link} />
          <span>{charCount} 字</span>
        </div>
        <div className="notes-editor-body">
          <TiptapEditor
            key={currentNote.id}
            value={currentNote.content || emptyDoc()}
            onChange={(content) => updateCurrentNote({ content })}
            placeholder="写下长期计划、灵感、素材或任何不属于某一天的内容..."
            isFullScreen={fullscreenShown}
            fullScreenLeaving={fullscreenLeaving}
            onToggleFullScreen={() => toggleFullscreen(currentNote.id)}
            onSave={flushPending}
            fontSize={activeFontSize}
            onFontSizeChange={changeFontSize}
            onCharCountChange={setCharCount}
          />
        </div>
      </>
    )
  }

  return (
    // The panel is the fullscreen layer's ancestor: while fullscreen it must drop its own
    // animation and transform (see .notes-fullscreen-active-parent).
    <main className={`notes-editor-panel ${fullscreenShown ? 'notes-fullscreen-active-parent' : ''}`}>
      {renderBody()}
    </main>
  )
}
