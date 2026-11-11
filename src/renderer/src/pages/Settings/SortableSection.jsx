import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SelectMenu from '../../components/SelectMenu'
import { NUMBER_DEFAULT_MODE, getNumberDefaultMode } from '../../utils/sectionDefaults'

const DEFAULT_SECTION_COLOR = '#7c6aff'

// One row of the section list: drag handle, inline rename, type, and the section's settings.
export default function SortableSection({ section, onToggleResident, onChangeColor, onRename, onChangeNumberDefaultMode, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(section.name)
  const inputRef = useRef(null)

  // Keep editName in sync if section.name changes externally
  useEffect(() => { setEditName(section.name) }, [section.name])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    boxShadow: isDragging ? 'var(--shadow-md)' : 'none',
  }

  const startEdit = () => {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }

  const commitEdit = () => {
    setEditing(false)
    if (editName.trim() && editName.trim() !== section.name) {
      onRename(editName.trim())
    } else {
      setEditName(section.name)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { setEditing(false); setEditName(section.name) }
  }

  const color = section.color || DEFAULT_SECTION_COLOR

  return (
    <div ref={setNodeRef} style={style} className={`settings-section-item ${isDragging ? 'dragging' : ''}`}>
      <div className="drag-handle" {...attributes} {...listeners}>☷</div>
      <div className="sec-item-info">
        {editing ? (
          <input
            ref={inputRef}
            className="input sec-item-name-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className="sec-item-name sec-item-name-editable"
            role="button"
            tabIndex={0}
            onClick={startEdit}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              startEdit()
            }}
            title="点击重命名"
          >
            {section.name}
            <span className="sec-rename-icon">✎</span>
          </span>
        )}
        <span className="sec-item-type">{section.type === 'text' ? '📝 文字' : `🔢 数字 ${section.unit ? `[${section.unit}]` : ''}`}</span>
      </div>
      <div className="sec-item-actions">
        {section.type === 'number' && (
          <div
            className="section-default-mode-select section-default-mode-select--compact"
            onPointerDown={e => e.stopPropagation()}
            title="数字默认填充方式"
          >
            <SelectMenu
              ariaLabel={`${section.name}的数字默认填充方式`}
              options={[
                { value: NUMBER_DEFAULT_MODE.MANUAL, label: '每日手动输入' },
                { value: NUMBER_DEFAULT_MODE.CARRY, label: '延续前一日' }
              ]}
              value={getNumberDefaultMode(section)}
              onChange={onChangeNumberDefaultMode}
            />
          </div>
        )}
        <label className="color-swatch-btn" title="修改版块颜色" style={{ '--swatch-color': color }}>
          <input
            type="color"
            value={color}
            onChange={e => onChangeColor(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            aria-label={`${section.name}的颜色`}
          />
          <span className="color-swatch-circle" style={{ background: color }} />
        </label>
        <button
          className={`btn btn-sm ${section.resident ? 'btn-primary' : 'btn-ghost'}`}
          aria-pressed={Boolean(section.resident)}
          onClick={onToggleResident}
        >
          {section.resident ? '★ 常驻' : '☆ 常驻'}
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} aria-label={`删除版块 ${section.name}`} onClick={onDelete}>🗑</button>
      </div>
    </div>
  )
}
