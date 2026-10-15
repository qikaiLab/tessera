import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AnalyticsCardEditor from '../../components/AnalyticsCardEditor'
import { buildChartData, getHeatmapColor } from '../../utils/analyticsData'
import { separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'
import { isEditableMenuTarget } from '../../utils/editableText'
import ChartRenderer from './ChartRenderer'

// One chart: title and actions, the (collapsible) settings editor, and the chart itself.
function AnalyticsCard({ card, sections, loadedData, datesWithData, palette, isEditing, onEdit, onUpdate, onDelete, onDuplicate, dragHandleProps }) {
  const chartData = useMemo(
    () => buildChartData(card, sections, loadedData, datesWithData, palette),
    [card, sections, loadedData, datesWithData, palette]
  )
  const bindings = useMemo(() => card.bindings || [], [card.bindings])
  const heatmapColor = useMemo(() => getHeatmapColor(card, sections, palette), [card, sections, palette])

  // Mount the editor on first open and keep it so the collapse animation can play.
  const [editorMounted, setEditorMounted] = useState(isEditing)
  useEffect(() => {
    if (isEditing) setEditorMounted(true)
  }, [isEditing])

  useContextMenuCommand('analytics-card', useCallback((id, context) => {
    if (context?.cardId !== card.id) return
    if (id === 'edit') onEdit()
    else if (id === 'duplicate') onDuplicate()
    else if (id === 'delete') onDelete()
  }, [card.id, onDelete, onDuplicate, onEdit]))

  const handleContextMenu = useCallback((event) => {
    if (isEditableMenuTarget(event.target)) return
    showContextMenu(event, [
      { id: 'edit', label: isEditing ? '收起编辑' : '编辑' },
      { id: 'duplicate', label: '复制图表' },
      separator,
      { id: 'delete', label: '删除', tone: 'danger' }
    ], {
      scope: 'analytics-card',
      cardId: card.id
    })
  }, [card.id, isEditing])

  return (
    <div className={`analytics-card card ${isEditing ? 'editing' : ''}`} onContextMenu={handleContextMenu}>
      <div className="analytics-card-header">
        <span
          {...dragHandleProps}
          className="analytics-drag-handle"
          title="拖拽排序"
          style={{ cursor: 'grab', fontSize: 16, color: 'var(--text-muted)', marginRight: 6, userSelect: 'none' }}
        >
          ☷
        </span>
        <input
          className="analytics-card-title"
          value={card.title}
          onChange={e => onUpdate({ title: e.target.value })}
        />
        <div className="analytics-card-actions">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title="配置">
            {isEditing ? '✕' : '⚙'}
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDuplicate} title="复制">⧉</button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} title="删除" style={{ color: 'var(--error)' }}>🗑</button>
        </div>
      </div>

      {/* Stays mounted after the first open so closing can animate; inert while collapsed. */}
      <div
        className={`card-editor-collapse ${isEditing ? 'is-open' : ''}`}
        aria-hidden={!isEditing}
        inert={isEditing ? undefined : ''}
      >
        <div className="card-editor-collapse-inner">
          {editorMounted && (
            <AnalyticsCardEditor card={card} sections={sections} onUpdate={onUpdate} />
          )}
        </div>
      </div>

      <div className="analytics-chart-area">
        {chartData.length === 0 || bindings.length === 0 ? (
          <div className="chart-empty">
            <p>绑定数据版块后显示图表</p>
          </div>
        ) : (
          <ChartRenderer card={card} data={chartData} sections={sections} heatmapColor={heatmapColor} palette={palette} />
        )}
      </div>
    </div>
  )
}

// The card wrapped so the page can drag it into a new position.
export default function SortableCard(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.card.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.85 : 1,
  }
  return (
    <div id={props.id} ref={setNodeRef} style={style}>
      <AnalyticsCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}
