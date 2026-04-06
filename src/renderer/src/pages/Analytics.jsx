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
import './Analytics.css'

const CHART_TYPES = [
  { id: 'line', label: '折线图', icon: '📈' },
  { id: 'bar', label: '柱状图', icon: '📊' },
  { id: 'pie', label: '饼图', icon: '🍩' },
  { id: 'heatmap', label: '热力图', icon: '🗓' }
]

const DATE_RANGES = [
  { id: '7', label: '近7天' },
  { id: '30', label: '近30天' },
  { id: '90', label: '近90天' },
  { id: '365', label: '近一年' },
  { id: 'all', label: '全部' }
]

const PALETTE = ['#7c6aff', '#34d399', '#f87171', '#fbbf24', '#60a5fa', '#f472b6']

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

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
    dateFrom: '',
    dateTo: ''
  }
}

export default function Analytics() {
  const { sections, datesWithData } = useApp()
  const [cards, setCards] = useState(() => {
    try {
      const s = localStorage.getItem('mototrace_analytics')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const [editingCard, setEditingCard] = useState(null)
  const [loadedData, setLoadedData] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null) // card id pending deletion

  useEffect(() => {
    localStorage.setItem('mototrace_analytics', JSON.stringify(cards))
  }, [cards])

  useEffect(() => {
    if (!datesWithData.length) return
    const fetchAll = async () => {
      const result = {}
      for (const d of datesWithData) {
        const [y, m, day] = d.split('-')
        const r = await window.api.fs.readFile(`${y}/${m}/${day}.json`)
        if (r.ok) { try { result[d] = JSON.parse(r.data) } catch {} }
      }
      setLoadedData(result)
    }
    fetchAll()
  }, [datesWithData])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
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

function getDateRange(card, datesWithData) {
  if (card.dateRange === 'all') return datesWithData
  if (card.dateRange === 'custom' && card.dateFrom && card.dateTo) {
    return datesWithData.filter(d => d >= card.dateFrom && d <= card.dateTo)
  }
  const days = parseInt(card.dateRange)
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd')
  return datesWithData.filter(d => d >= cutoff)
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

function buildChartData(card, sections, loadedData, datesWithData) {
  const dates = getDateRange(card, datesWithData).sort()
  const bindings = card.bindings || []

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
      return { name: sec.name, value: parseFloat(total.toFixed(2)), fill: sec.color || PALETTE[i % PALETTE.length] }
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
    const point = { date: format(parseISO(d), 'MM/dd') }
    bindings.forEach(b => {
      const sec = sections.find(s => s.id === b.sectionId)
      if (!sec) return
      const entry = loadedData[d]?.[b.sectionId]
      let val = 0
      if (entry) {
        if (b.metric === 'wordcount') val = extractText(entry.value).replace(/\s+/g, '').length
        else val = parseFloat(entry.value) || 0
      }
      point[sec.name] = val
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

function AnalyticsCard({ card, sections, loadedData, datesWithData, isEditing, onEdit, onUpdate, onDelete, onDuplicate, dragHandleProps }) {
  const chartData = useMemo(
    () => buildChartData(card, sections, loadedData, datesWithData),
    [card, sections, loadedData, datesWithData]
  )

  const bindings = card.bindings || []

  // Task 5.3: get heatmap color from section palette index
  const heatmapColor = useMemo(() => {
    if (card.type !== 'heatmap' || !bindings[0]) return PALETTE[0]
    const sec = sections.find(s => s.id === bindings[0].sectionId)
    if (sec && sec.color) return sec.color
    const idx = sections.findIndex(s => s.id === bindings[0].sectionId)
    return PALETTE[Math.max(0, idx) % PALETTE.length]
  }, [card.type, bindings, sections])

  return (
    <div className={`analytics-card card ${isEditing ? 'editing' : ''}`}>
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

      {isEditing && (
        <CardEditor
          card={card}
          sections={sections}
          onUpdate={onUpdate}
        />
      )}

      <div className="analytics-chart-area">
        {chartData.length === 0 || bindings.length === 0 ? (
          <div className="chart-empty">
            <p>绑定数据版块后显示图表</p>
          </div>
        ) : (
          <ChartRenderer card={card} data={chartData} sections={sections} heatmapColor={heatmapColor} />
        )}
      </div>
    </div>
  )
}

// ─── Card Editor ──────────────────────────────────────────────────────────────

function CardEditor({ card, sections, onUpdate }) {
  const isHeatmap = card.type === 'heatmap'
  const hasMaxBindings = isHeatmap && (card.bindings || []).length >= 1 // Task 5.1: heatmap max 1

  const addBinding = () => {
    const sec = sections[0]
    if (!sec) return
    // Task 3: auto-lock metric based on section type
    const metric = sec.type === 'text' ? 'wordcount' : 'value'
    onUpdate({ bindings: [...(card.bindings || []), { sectionId: sec.id, metric }] })
  }

  const updateBinding = (i, sectionId) => {
    const sec = sections.find(s => s.id === sectionId)
    if (!sec) return
    const metric = sec.type === 'text' ? 'wordcount' : 'value'
    const next = [...(card.bindings || [])]
    next[i] = { sectionId, metric }
    onUpdate({ bindings: next })
  }

  const removeBinding = (i) => {
    onUpdate({ bindings: (card.bindings || []).filter((_, idx) => idx !== i) })
  }

  return (
    <div className="card-editor">
      {/* Chart type */}
      <div className="editor-row">
        <label className="editor-label">图表类型</label>
        <div className="chart-type-selector">
          {CHART_TYPES.map(t => (
            <button
              key={t.id}
              className={`chart-type-btn ${card.type === t.id ? 'active' : ''}`}
              onClick={() => onUpdate({ type: t.id, bindings: [] })}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div className="editor-row">
        <label className="editor-label">时间范围</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DATE_RANGES.map(r => (
            <button
              key={r.id}
              className={`btn btn-sm ${card.dateRange === r.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onUpdate({ dateRange: r.id })}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bindings */}
      <div className="editor-row">
        <label className="editor-label">
          数据绑定
          {isHeatmap && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>（热力图仅支持1个数据源）</span>}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(card.bindings || []).map((b, i) => {
            const sec = sections.find(s => s.id === b.sectionId)
            // Task 3: show metric as read-only badge
            const metricLabel = b.metric === 'wordcount' ? '字数' : '数值'
            return (
              <div key={i} className="binding-row">
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={b.sectionId}
                  onChange={e => updateBinding(i, e.target.value)}
                >
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {/* Task 3: metric locked badge (no manual selection) */}
                <span
                  className="btn btn-sm btn-secondary"
                  style={{ width: 60, textAlign: 'center', pointerEvents: 'none', opacity: 0.75 }}
                >
                  {metricLabel}
                </span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeBinding(i)}>✕</button>
              </div>
            )
          })}
          {/* Task 5.1: hide add button when heatmap already has 1 binding */}
          {sections.length > 0 && !hasMaxBindings && (
            <button className="btn btn-ghost btn-sm" onClick={addBinding}>⊕ 添加数据</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chart Renderer ───────────────────────────────────────────────────────────

const TooltipStyle = {
  contentStyle: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '12px',
    color: 'var(--text-primary)'
  },
  labelStyle: { color: 'var(--text-secondary)' }
}

function ChartRenderer({ card, data, sections, heatmapColor }) {
  const keys = sections
    .filter(s => (card.bindings || []).some(b => b.sectionId === s.id))
    .map(s => s.name)

  // Task 4: determine Y-axis display mode
  // 1 binding => single left Y-axis
  // 2 bindings => dual Y-axis (left + right)
  // 3+ bindings => no Y-axis, only legend
  const yMode = keys.length <= 1 ? 'single' : keys.length === 2 ? 'dual' : 'none'

  if (card.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          {yMode === 'single' && (
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={40} />
          )}
          {yMode === 'dual' && (
            <>
              <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[0])?.color || PALETTE[0] }} width={40} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[1])?.color || PALETTE[1] }} width={40} />
            </>
          )}
          <Tooltip {...TooltipStyle} />
          {(yMode === 'dual' || yMode === 'none' || keys.length > 1) && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {keys.map((k, i) => {
            const sec = sections.find(s => s.name === k)
            const color = sec?.color || PALETTE[i % PALETTE.length]
            return (
              <Line
                key={k}
                type="monotone"
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
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          {yMode === 'single' && (
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={40} />
          )}
          {yMode === 'dual' && (
            <>
              <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[0])?.color || PALETTE[0] }} width={40} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: sections.find(s => s.name === keys[1])?.color || PALETTE[1] }} width={40} />
            </>
          )}
          <Tooltip {...TooltipStyle} />
          {(yMode === 'dual' || yMode === 'none' || keys.length > 1) && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {keys.map((k, i) => {
            const sec = sections.find(s => s.name === k)
            const color = sec?.color || PALETTE[i % PALETTE.length]
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
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
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
  const max = data.length ? Math.max(...data.map(d => d.value), 1) : 1

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
    if (v === 0) return 'rgba(128,128,128,0.15)'
    const intensity = v / max
    return hexToRgba(color, Math.max(0.15, intensity))
  }

  if (!data.length) return null

  // 7-day range => horizontal row layout
  if (dateRange === '7') {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    return (
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
    )
  }

  // compact centered for 30/90 days
  const isCompact = dateRange === '30' || dateRange === '90'

  return (
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
  )
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}
