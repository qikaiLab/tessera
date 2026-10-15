import SelectMenu from '../../components/SelectMenu'
import {
  DATE_FILTER,
  EMPTY_DATE_FILTER,
  extractNoteText,
  formatDateLinkLabel,
  formatNoteTime,
  noteTitle,
  normalizeDateLink
} from '../../utils/notes'
import './NotesListPanel.css'

const DATE_FILTER_OPTIONS = [
  { value: DATE_FILTER.ALL, label: '全部日期' },
  { value: DATE_FILTER.LINKED, label: '有日期关联' },
  { value: DATE_FILTER.UNLINKED, label: '无日期关联' },
  { value: DATE_FILTER.CONTAINS, label: '包含某一天' },
  { value: DATE_FILTER.OVERLAP, label: '与时间段交集' }
]

function NoteSearch({ query, onChange }) {
  return (
    <div className="notes-search-row">
      <div className="search-wrap">
        <span className="search-icon">⌕</span>
        <input
          className="input search-input"
          value={query}
          onChange={e => onChange(e.target.value)}
          placeholder="搜索便签"
        />
        {query && (
          <button type="button" className="notes-search-clear" onClick={() => onChange('')} title="清空搜索">
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// Current / archived switch and the date filter with the fields its mode needs.
function NoteFilters({ showArchived, onShowArchived, dateFilter, onDateFilterChange }) {
  const dateFilterActive = dateFilter.mode !== DATE_FILTER.ALL
  const setField = (field, value) => onDateFilterChange(prev => ({ ...prev, [field]: value }))

  return (
    <>
      <div className="notes-filter-bar">
        <div className="notes-status-toggle" role="group" aria-label="便签状态">
          <button
            type="button"
            className={`notes-status-pill ${!showArchived ? 'active' : ''}`}
            onClick={() => onShowArchived(false)}
          >
            当前
          </button>
          <button
            type="button"
            className={`notes-status-pill ${showArchived ? 'active' : ''}`}
            onClick={() => onShowArchived(true)}
          >
            归档
          </button>
        </div>

        <div className={`notes-date-filter ${dateFilterActive ? 'active' : ''}`}>
          <SelectMenu
            ariaLabel="日期筛选"
            className="notes-date-filter-select"
            options={DATE_FILTER_OPTIONS}
            value={dateFilter.mode}
            onChange={mode => setField('mode', mode)}
          />
          {dateFilterActive && (
            <button
              type="button"
              className="btn btn-ghost btn-icon notes-date-filter-clear"
              onClick={() => onDateFilterChange(EMPTY_DATE_FILTER)}
              title="清除日期筛选"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className={`notes-date-filter-fields ${dateFilterActive ? 'active' : ''}`}>
        {dateFilter.mode === DATE_FILTER.CONTAINS && (
          <input
            className="input notes-date-filter-input"
            type="date"
            value={dateFilter.date}
            onChange={e => setField('date', e.target.value)}
          />
        )}
        {dateFilter.mode === DATE_FILTER.OVERLAP && (
          <div className="notes-date-filter-range">
            <input
              className="input notes-date-filter-input"
              type="date"
              value={dateFilter.start}
              onChange={e => setField('start', e.target.value)}
            />
            <span>至</span>
            <input
              className="input notes-date-filter-input"
              type="date"
              value={dateFilter.end}
              onChange={e => setField('end', e.target.value)}
            />
          </div>
        )}
      </div>
    </>
  )
}

function NoteListItem({ note, index, active, onSelect, onContextMenu }) {
  const dateLink = normalizeDateLink(note.dateLink)
  return (
    <button
      style={{ '--enter-delay': `${Math.min(index, 8) * 36}ms` }}
      className={`notes-list-item ${active ? 'active' : ''}`}
      onClick={() => onSelect(note)}
      onContextMenu={(event) => onContextMenu(event, note)}
    >
      <div className="notes-list-item-top">
        <span className="notes-list-title">{noteTitle(note)}</span>
        {note.pinned && <span className="notes-pin-dot">置顶</span>}
      </div>
      <p className="notes-list-snippet">{extractNoteText(note.content) || '空白便签'}</p>
      <div className="notes-list-footer">
        <span className="notes-list-time">{formatNoteTime(note.updatedAt)}</span>
        {dateLink && (
          <span className={`notes-date-badge ${dateLink.type === 'range' ? 'range' : ''}`}>
            {formatDateLinkLabel(dateLink)}
          </span>
        )}
      </div>
    </button>
  )
}

// The left column: title and new button, search, filters and the list of notes.
export default function NotesListPanel({
  notes,
  loading,
  showSkeleton,
  selectedId,
  query,
  onQueryChange,
  showArchived,
  onShowArchived,
  dateFilter,
  onDateFilterChange,
  onCreate,
  onSelect,
  onNoteContextMenu,
  onBlankContextMenu
}) {
  return (
    <aside className="notes-list-panel">
      <div className="notes-list-header">
        <div className="notes-heading">
          <h1 className="notes-title">便签</h1>
          {!loading && <span className="notes-count">{notes.length} 条</span>}
        </div>
        <button className="btn btn-primary btn-icon notes-new-btn" onClick={onCreate} title="新建便签">
          +
        </button>
      </div>

      <NoteSearch query={query} onChange={onQueryChange} />
      <NoteFilters
        showArchived={showArchived}
        onShowArchived={onShowArchived}
        dateFilter={dateFilter}
        onDateFilterChange={onDateFilterChange}
      />

      <div className="notes-list" onContextMenu={onBlankContextMenu}>
        {loading ? (
          showSkeleton && <div className="notes-list-loading">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : notes.length === 0 ? (
          <div className="notes-empty-list">
            <span>{showArchived ? '暂无归档便签' : '暂无便签'}</span>
          </div>
        ) : (
          notes.map((note, index) => (
            <NoteListItem
              key={note.id}
              note={note}
              index={index}
              active={selectedId === note.id}
              onSelect={onSelect}
              onContextMenu={onNoteContextMenu}
            />
          ))
        )}
      </div>
    </aside>
  )
}
