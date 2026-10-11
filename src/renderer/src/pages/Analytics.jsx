import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns'
import { useApp } from '../context/AppContext'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isEditableMenuTarget, separator, showContextMenu, useContextMenuCommand } from '../utils/contextMenu'
import { createHeatmapScale, getHeatmapAlpha, HEATMAP_EMPTY_COLOR } from '../utils/heatmapScale'
import {
  DATE_AXIS_CONTINUOUS,
  DATE_AXIS_RECORDED,
  LINE_STYLE_SMOOTH,
  LINE_STYLE_STRAIGHT,
  getDateAxisMode,
  getLineStyle
} from '../utils/analyticsCard'
import AnalyticsCardEditor from '../components/AnalyticsCardEditor'
import './Analytics.css'

const SECONDARY_PALETTE = ['#34d399', '#f87171', '#fbbf24', '#60a5fa', '#f472b6']
const NUMBER_DEFAULT_MODE_CARRY = 'carry'

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

function isCarryNumberSection(section) {
  return section?.type === 'number' && section.numberDefaultMode === NUMBER_DEFAULT_MODE_CARRY
}

function hasStoredValue(entry) {
  return entry?.value !== undefined && entry?.value !== null && String(entry.value).trim() !== ''
}

function getRenderedAccentColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#7c6aff'
}

/**
 * Extract plain text from a persisted value (Tiptap JSON string or plain string).
 */
function extractText(value) {
  if (!value) return ''
  const str = String(value)
  try {
    const json = JSON.parse(str)
    return extractNodeText(json)
  } catch {
    return str
  }
}
function extractNodeText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  if (Array.isArray(node.content)) return node.content.map(extractNodeText).join('')
  return ''
}

function defaultCard(idx) {
  return {
    id: generateId(),
    title: `图表 ${idx + 1}`,
    type: 'bar',
    bindings: [],
    dateRange: '30',
    dateAxisMode: DATE_AXIS_RECORDED,
    lineStyle: LINE_STYLE_SMOOTH,
    dateFrom: '',
    dateTo: ''
  }
}

export default function Analytics() {
  const {
    sections, datesWithData, analytics: cards, saveAnalytics: setCards
  } = useApp()
  const [editingCard, setEditingCard] = useState(null)
  const [loadedData, setLoadedData] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null) // card id pending deletion
  const accentColor = getRenderedAccentColor()
  const palette = useMemo(() => [accentColor, ...SECONDARY_PALETTE], [accentColor])

  useEffect(() => {
    if (!datesWithData.length) return
    let aborted = false
    const fetchAll = async () => {
      // Fix #6: Parallel loading instead of serial for...await
      const entries = await Promise.all(
        datesWithData.map(async (d) => {
          const [y, m, day] = d.split('-')
          const r = await window.api.fs.readFile(`${y}/${m}/${day}.json`)
          if (r.ok) {
            try { return [d, JSON.parse(r.data)] } catch (e) {
              console.error(`Failed to parse ${d}:`, e)
              return null
            }
          }
          return null
        })
      )
      if (aborted) return
      const result = {}
      for (const entry of entries) {
        if (entry) result[entry[0]] = entry[1]
      }
      setLoadedData(result)
    }
    fetchAll()
    return () => { aborted = true }
  }, [datesWithData])

  // DnD sensors
  const sensors = useSensors(
    // A plain click on the handle must not start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    // Dropping outside every card leaves `over` empty: nothing to reorder.
    if (over && active.id !== over.id) {
      setCards(prev => {
        const oldIndex = prev.findIndex(c => c.id === active.id)
        const newIndex = prev.findIndex(c => c.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const addCard = () => {
    const card = defaultCard(cards.length)
    setCards(prev => [...prev, card])
    setEditingCard(card.id)
    // Task 4: scroll new card into view after state update
    setTimeout(() => {
      const el = document.getElementById(`analytics-card-${card.id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const updateCard = (id, updates) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  // Task 6: delete with confirmation
  const requestDelete = (id) => setDeleteConfirm(id)

  const confirmDelete = () => {
    if (deleteConfirm) {
      setCards(prev => prev.filter(c => c.id !== deleteConfirm))
      if (editingCard === deleteConfirm) setEditingCard(null)
    }
    setDeleteConfirm(null)
  }

  const cancelDelete = () => setDeleteConfirm(null)

  const duplicateCard = (id) => {
    const src = cards.find(c => c.id === id)
    if (!src) return
    const newCard = { ...src, id: generateId(), title: src.title + ' 副本' }
    setCards(prev => [...prev, newCard])
    // Task 4: scroll to the newly duplicated card
    setTimeout(() => {
      const el = document.getElementById(`analytics-card-${newCard.id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }


  return (
    <div className="analytics-page">
      <div className="page-header">
        <span className="page-title">数据分析</span>
        <button className="btn btn-primary btn-sm" onClick={addCard}>⊕ 新建图表</button>
      </div>
      <div className="page-content analytics-content">
        {cards.length === 0 ? (
          <div className="empty-state" style={{ height: '70%' }}>
            <span className="empty-state-icon">∑</span>
            <p className="empty-state-title">还没有图表</p>
            <p className="empty-state-desc">点击「新建图表」创建你的第一个数据可视化卡片</p>
            <button className="btn btn-primary" onClick={addCard}>创建图表</button>
          </div>
        ) : (
          // Task 7: DnD sortable wrapper
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cards.map(c => c.id)} strategy={rectSortingStrategy}>
              <div className="analytics-grid">
                {cards.map(card => (
                  <SortableCard
                    key={card.id}
                    id={`analytics-card-${card.id}`}
                    card={card}
                    sections={sections}
                    loadedData={loadedData}
                    datesWithData={datesWithData}
                    palette={palette}
                    isEditing={editingCard === card.id}
                    onEdit={() => setEditingCard(editingCard === card.id ? null : card.id)}
                    onUpdate={(u) => updateCard(card.id, u)}
                    onDelete={() => requestDelete(card.id)}
                    onDuplicate={() => duplicateCard(card.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Task 6: Delete confirmation modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">删除图表</span>
              <button className="btn btn-ghost btn-icon" onClick={cancelDelete}>✕</button>
            </div>
            <div style={{ marginBottom: 20, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <p>确定要删除图表 <b>「{cards.find(c => c.id === deleteConfirm)?.title}」</b> 吗？</p>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>此操作无法撤销。</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={cancelDelete}>取消</button>
              <button className="btn btn-primary" style={{ background: 'var(--error)' }} onClick={confirmDelete}>确定删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Date Range ───────────────────────────────────────────────────────────────

function getRecordedDateRange(card, datesWithData) {
  if (card.dateRange === 'all') return datesWithData
  if (card.dateRange === 'custom' && card.dateFrom && card.dateTo) {
    return datesWithData.filter(d => d >= card.dateFrom && d <= card.dateTo)
  }
  const days = parseInt(card.dateRange)
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd')
  return datesWithData.filter(d => d >= cutoff)
}

function getContinuousDateRange(card, datesWithData, bindings = [], loadedData = {}) {
  let start
  let end

  if (card.dateRange === 'custom' && card.dateFrom && card.dateTo) {
    start = parseISO(card.dateFrom)
    end = parseISO(card.dateTo)
  } else if (card.dateRange === 'all') {
    const boundDates = datesWithData.filter(d => hasChartBindingData(d, bindings, loadedData))
    const sorted = (boundDates.length ? boundDates : datesWithData).sort()
    if (!sorted.length) return []
    start = parseISO(sorted[0])
    end = parseISO(sorted[sorted.length - 1])
  } else {
    const days = parseInt(card.dateRange) || 30
    end = new Date()
    start = subDays(end, days - 1)
  }

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return []
  }

  return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'))
}

function getDateRange(card, datesWithData, bindings = [], loadedData = {}) {
  if ((card.type === 'line' || card.type === 'bar') && getDateAxisMode(card) === DATE_AXIS_CONTINUOUS) {
    return getContinuousDateRange(card, datesWithData, bindings, loadedData)
  }

  return getRecordedDateRange(card, datesWithData)
}

// Generate all calendar days in range (for heatmap), aligned to Mon-Sun columns
function getAllDaysInRange(card) {
  const days = card.dateRange === 'all' ? 365 : parseInt(card.dateRange) || 30
  const end = new Date()
  const start = subDays(end, days - 1)
  // Task 7.4: pad start back to Monday so every column is Mon-Sun
  const dayOfWeek = start.getDay() // 0=Sun,1=Mon,...
  const daysFromMon = (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
  const paddedStart = subDays(start, daysFromMon)
  return eachDayOfInterval({ start: paddedStart, end }).map(d => format(d, 'yyyy-MM-dd'))
}

// ─── Chart Data Builder ───────────────────────────────────────────────────────

function hasChartBindingData(dateStr, bindings, loadedData) {
  return bindings.some(b => {
    const entry = loadedData[dateStr]?.[b.sectionId]
    if (!hasStoredValue(entry)) return false

    if (b.metric === 'wordcount') {
      return extractText(entry.value).replace(/\s+/g, '').length > 0
    }

    return String(entry.value).trim() !== ''
  })
}

function findRecentNumberValue(dateStr, sectionId, loadedData) {
  const previousDates = Object.keys(loadedData)
    .filter(d => d < dateStr)
    .sort((a, b) => b.localeCompare(a))

  for (const d of previousDates) {
    const entry = loadedData[d]?.[sectionId]
    if (hasStoredValue(entry)) return parseFloat(entry.value) || 0
  }

  return 0
}

function resolveBindingValue(dateStr, binding, section, loadedData) {
  const entry = loadedData[dateStr]?.[binding.sectionId]

  if (hasStoredValue(entry)) {
    if (binding.metric === 'wordcount') return extractText(entry.value).replace(/\s+/g, '').length
    return parseFloat(entry.value) || 0
  }

  if (binding.metric === 'value' && isCarryNumberSection(section)) {
    return findRecentNumberValue(dateStr, binding.sectionId, loadedData)
  }

  return 0
}

function formatAxisDate(value) {
  try {
    return format(parseISO(value), 'MM/dd')
  } catch {
    return value
  }
}

function formatTooltipDate(value) {
  try {
    return format(parseISO(value), 'yyyy-MM-dd')
  } catch {
    return value
  }
}

function buildChartData(card, sections, loadedData, datesWithData, palette) {
  const bindings = card.bindings || []
  const dateCandidates = getDateRange(card, datesWithData, bindings, loadedData).sort()
  const dates = card.type === 'line' || card.type === 'bar'
    ? getDateAxisMode(card) === DATE_AXIS_CONTINUOUS
      ? dateCandidates
      : dateCandidates.filter(d => hasChartBindingData(d, bindings, loadedData))
    : dateCandidates

  if (card.type === 'pie') {
    return bindings.map((b, i) => {
      const sec = sections.find(s => s.id === b.sectionId)
      if (!sec) return null
      let total = 0
      for (const d of dates) {
        const entry = loadedData[d]?.[b.sectionId]
        if (entry) {
          if (b.metric === 'wordcount') {
            total += extractText(entry.value).replace(/\s+/g, '').length
          } else {
            total += parseFloat(entry.value) || 0
          }
        }
      }
      return { name: sec.name, value: parseFloat(total.toFixed(2)), fill: sec.color || palette[i % palette.length] }
    }).filter(Boolean)
  }

  if (card.type === 'heatmap') {
    // Task 5.2: show all days in range, not just days with data
    const allDays = card.dateRange === 'all' ? dates : getAllDaysInRange(card)
    const b = bindings[0]
    if (!b) return allDays.map(d => ({ date: d, value: 0 }))
    return allDays.map(d => {
      const entry = loadedData[d]?.[b.sectionId]
      let val = 0
      if (entry) {
        if (b.metric === 'wordcount') val = extractText(entry.value).replace(/\s+/g, '').length
        else val = parseFloat(entry.value) || 0
      }
      return { date: d, value: val }
    })
  }

  return dates.map(d => {
    const point = { date: d }
    bindings.forEach(b => {
      const sec = sections.find(s => s.id === b.sectionId)
      if (!sec) return
      point[sec.name] = resolveBindingValue(d, b, sec, loadedData)
    })
    return point
  })
}

// ─── Sortable Card Wrapper (Task 7) ──────────────────────────────────────────

function SortableCard(props) {
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

// ─── Analytics Card ───────────────────────────────────────────────────────────

function AnalyticsCard({ card, sections, loadedData, datesWithData, palette, isEditing, onEdit, onUpdate, onDelete, onDuplicate, dragHandleProps }) {
  const chartData = useMemo(
    () => buildChartData(card, sections, loadedData, datesWithData, palette),
    [card, sections, loadedData, datesWithData, palette]
  )

  const bindings = useMemo(() => card.bindings || [], [card.bindings])

  // Mount the editor on first open and keep it so the collapse animation can play.
  const [editorMounted, setEditorMounted] = useState(isEditing)
  useEffect(() => {
    if (isEditing) setEditorMounted(true)
  }, [isEditing])

  // Task 5.3: get heatmap color from section palette index
  const heatmapColor = useMemo(() => {
    if (card.type !== 'heatmap' || !bindings[0]) return palette[0]
    const sec = sections.find(s => s.id === bindings[0].sectionId)
    if (sec && sec.color) return sec.color
    const idx = sections.findIndex(s => s.id === bindings[0].sectionId)
    return palette[Math.max(0, idx) % palette.length]
  }, [card.type, bindings, palette, sections])

  useContextMenuCommand('analytics-card', useCallback((id, context) => {
    if (context?.cardId !== card.id) return
    if (id === 'edit') {
      onEdit()
      return
    }
    if (id === 'duplicate') {
      onDuplicate()
      return
    }
    if (id === 'delete') {
      onDelete()
    }
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
        {/* Drag handle */}
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
            <AnalyticsCardEditor
              card={card}
              sections={sections}
              onUpdate={onUpdate}
            />
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

// ─── Chart Renderer ───────────────────────────────────────────────────────────

const TooltipStyle = {
  contentStyle: {
    background: 'var(--chart-tooltip-background)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--chart-tooltip-shadow)',
    fontSize: '12px',
    color: 'var(--chart-tooltip-text)'
  },
  itemStyle: { color: 'var(--chart-tooltip-text)' },
  labelStyle: { color: 'var(--chart-tooltip-label)' },
  labelFormatter: formatTooltipDate
}

function ChartRenderer({ card, data, sections, heatmapColor, palette }) {
  const keys = sections
    .filter(s => (card.bindings || []).some(b => b.sectionId === s.id))
    .map(s => s.name)

  // Task 4: determine Y-axis display mode
  // 1 binding => single left Y-axis
  // 2 bindings => dual Y-axis (left + right)
  // 3+ bindings => no Y-axis, only legend
  const yMode = keys.length <= 1 ? 'single' : keys.length === 2 ? 'dual' : 'none'

  if (card.type === 'line') {
    const lineType = getLineStyle(card) === LINE_STYLE_STRAIGHT ? 'linear' : 'monotone'

    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            minTickGap={18}
            interval="preserveStartEnd"
          />
          {yMode === 'single' && (
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={40} />
          )}
          {yMode === 'dual' && (
            <>
              <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[0])?.color || palette[0] }} width={40} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[1])?.color || palette[1] }} width={40} />
            </>
          )}
          <Tooltip {...TooltipStyle} />
          {(yMode === 'dual' || yMode === 'none' || keys.length > 1) && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {keys.map((k, i) => {
            const sec = sections.find(s => s.name === k)
            const color = sec?.color || palette[i % palette.length]
            return (
              <Line
                key={k}
                type={lineType}
                dataKey={k}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                yAxisId={yMode === 'dual' ? (i === 0 ? 'left' : 'right') : yMode === 'single' ? 'left' : undefined}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (card.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            minTickGap={18}
            interval="preserveStartEnd"
          />
          {yMode === 'single' && (
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={40} />
          )}
          {yMode === 'dual' && (
            <>
              <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[0])?.color || palette[0] }} width={40} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[1])?.color || palette[1] }} width={40} />
            </>
          )}
          <Tooltip {...TooltipStyle} />
          {(yMode === 'dual' || yMode === 'none' || keys.length > 1) && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {keys.map((k, i) => {
            const sec = sections.find(s => s.name === k)
            const color = sec?.color || palette[i % palette.length]
            return (
              <Bar
                key={k}
                dataKey={k}
                fill={color}
                radius={[3, 3, 0, 0]}
                yAxisId={yMode === 'dual' ? (i === 0 ? 'left' : 'right') : yMode === 'single' ? 'left' : undefined}
              />
            )
          })}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (card.type === 'pie') {
    return (
      <ResponsiveContainer className="analytics-pie-chart" width="100%" height={220}>
        <PieChart margin={{ top: 20, right: 36, bottom: 20, left: 36 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip {...TooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (card.type === 'heatmap') {
    return <Heatmap data={data} color={heatmapColor} dateRange={card.dateRange} />
  }

  return null
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function Heatmap({ data, color, dateRange }) {
  const scrollRef = React.useRef(null)
  const scale = React.useMemo(() => createHeatmapScale(data.map(d => d.value)), [data])
  const maxValue = React.useMemo(() => data.reduce((max, d) => Math.max(max, d.value), 0), [data])

  // Scroll to rightmost on mount/data change
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [data])

  // Task 1: use addEventListener with {passive:false} to intercept wheel
  // and convert vertical scroll to horizontal — React's onWheel is passive
  // and cannot call preventDefault() reliably.
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return
      // Only intercept if overflow is occurring (content wider than container)
      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault()
        e.stopPropagation()
        el.scrollLeft += e.deltaY * 1.5
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [data])

  const getColor = (v) => {
    const intensity = scale(v)
    if (intensity === 0) return HEATMAP_EMPTY_COLOR
    return hexToRgba(color, getHeatmapAlpha(intensity))
  }

  const legend = (
    <div className="heatmap-legend" aria-hidden="true">
      <span>少</span>
      {[0, 0.25, 0.5, 0.75, 1].map(step => (
        <span
          key={step}
          className="heatmap-legend-swatch"
          style={{ background: step === 0 ? HEATMAP_EMPTY_COLOR : hexToRgba(color, getHeatmapAlpha(step)) }}
        />
      ))}
      <span>多</span>
      {maxValue > 0 && <span className="heatmap-legend-max">最高 {Number(maxValue.toFixed(2))}</span>}
    </div>
  )

  if (!data.length) return null

  // 7-day range => horizontal row layout
  if (dateRange === '7') {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    return (
      <div className="heatmap-block">
      <div className="heatmap-7d">
        {data.map((d, i) => {
          const dateObj = parseISO(d.date)
          return (
            <div key={i} className="heatmap-7d-col">
              <div className="heatmap-7d-label">{format(dateObj, 'MM/dd')}</div>
              <div
                className="heatmap-cell"
                style={{ background: getColor(d.value) }}
                title={`${d.date}: ${d.value}`}
              />
              <div className="heatmap-7d-weekday">{weekDays[dateObj.getDay()]}</div>
            </div>
          )
        })}
      </div>
      {legend}
      </div>
    )
  }

  // compact centered for 30/90 days
  const isCompact = dateRange === '30' || dateRange === '90'

  return (
    <div className="heatmap-block">
      <div
        className={`heatmap-wrapper${isCompact ? ' heatmap-compact' : ''}`}
        ref={scrollRef}
      >
        <div className={`heatmap${isCompact ? ' heatmap-compact-grid' : ''}`}>
          {data.map((d, i) => (
            <div
              key={i}
              className="heatmap-cell"
              style={{ background: getColor(d.value) }}
              title={`${d.date}: ${d.value}`}
            />
          ))}
        </div>
      </div>
      {legend}
    </div>
  )
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}
