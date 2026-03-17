import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, addYears, subYears,
  parseISO, startOfYear, endOfYear, eachMonthOfInterval,
  getWeek, setWeek, startOfWeek as startOfWeekFn
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import './Calendar.css'

const VIEWS = ['month', 'week', 'year']
const VIEW_LABELS = { month: '月', week: '周', year: '年' }

export default function Calendar() {
  const navigate = useNavigate()
  const { datesWithData, selectedDate, setSelectedDate } = useApp()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(new Date())
  const [countdowns, setCountdowns] = useState(() => {
    try {
      const saved = localStorage.getItem('mototrace_countdowns')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showCountdownModal, setShowCountdownModal] = useState(false)

  const datesSet = useMemo(() => new Set(datesWithData), [datesWithData])

  const saveCountdowns = useCallback((cds) => {
    setCountdowns(cds)
    localStorage.setItem('mototrace_countdowns', JSON.stringify(cds))
  }, [])

  const navigate_ = (dir) => {
    setCursor(prev => {
      if (view === 'month') return dir > 0 ? addMonths(prev, 1) : subMonths(prev, 1)
      if (view === 'week') return dir > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1)
      return dir > 0 ? addYears(prev, 1) : subYears(prev, 1)
    })
  }

  const handleDayClick = (date) => {
    setSelectedDate(date)
    navigate('/today')
  }

  const getCountdownsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return countdowns.filter(cd => cd.date === dateStr)
  }

  const getDayStatus = (date) => {
    const str = format(date, 'yyyy-MM-dd')
    const today = isToday(date)
    const selected = isSameDay(date, selectedDate)
    const hasData = datesSet.has(str)
    const cds = getCountdownsForDate(date)
    return { today, selected, hasData, countdowns: cds }
  }

  const headerTitle = () => {
    if (view === 'month') return format(cursor, 'yyyy年MM月', { locale: zhCN })
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 })
      const end = endOfWeek(cursor, { weekStartsOn: 1 })
      return `${format(start, 'MM月dd日')} — ${format(end, 'MM月dd日')}`
    }
    return format(cursor, 'yyyy年', { locale: zhCN })
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <span className="page-title">日历</span>
        <div className="tabs" style={{ width: 'auto' }}>
          {VIEWS.map(v => (
            <button key={v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {VIEW_LABELS[v]}视图
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCountdownModal(true)}>
          ⊕ 倒数日
        </button>
      </div>

      {/* Calendar Nav */}
      <div className="cal-nav">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate_(-1)}>←</button>
        <button className="cal-today-btn btn btn-ghost btn-sm" onClick={() => setCursor(new Date())}>
          今日
        </button>
        <span className="cal-header-title">{headerTitle()}</span>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate_(1)}>→</button>
      </div>

      {/* Calendar Grid */}
      <div className="cal-content">
        {view === 'month' && <MonthView cursor={cursor} getDayStatus={getDayStatus} onDayClick={handleDayClick} />}
        {view === 'week' && <WeekView cursor={cursor} getDayStatus={getDayStatus} onDayClick={handleDayClick} />}
        {view === 'year' && <YearView cursor={cursor} getDayStatus={getDayStatus} onDayClick={handleDayClick} />}
      </div>

      {/* Countdown Legend */}
      {countdowns.length > 0 && (
        <div className="countdown-legend">
          {countdowns.map(cd => {
            const target = parseISO(cd.date)
            const today = new Date()
            const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
            const label = diff > 0 ? `还有 ${diff} 天` : diff === 0 ? '今天！' : `已过 ${-diff} 天`
            return (
              <div key={cd.id} className="countdown-item">
                <span className="countdown-dot" style={{ background: cd.color || 'var(--accent)' }} />
                <span className="countdown-name">{cd.name}</span>
                <span className="countdown-diff">{label}</span>
              </div>
            )
          })}
        </div>
      )}

      {showCountdownModal && (
        <CountdownModal
          countdowns={countdowns}
          onSave={saveCountdowns}
          onClose={() => setShowCountdownModal(false)}
        />
      )}
    </div>
  )
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function MonthView({ cursor, getDayStatus, onDayClick }) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })
  const inMonth = (d) => isSameMonth(d, cursor)

  return (
    <div className="month-view">
      <div className="cal-weekdays">
        {WEEKDAYS.map(d => <span key={d} className="cal-weekday">{d}</span>)}
      </div>
      <div className="cal-grid month-grid">
        {days.map((day, i) => {
          const { today, selected, hasData, countdowns: cds } = getDayStatus(day)
          return (
            <button
              key={i}
              className={`cal-day ${inMonth(day) ? '' : 'other-month'} ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}`}
              onClick={() => onDayClick(day)}
            >
              <span className="cal-day-num">{format(day, 'd')}</span>
              {hasData && <span className="cal-dot" />}
              {cds.length > 0 && (
                <span className="cal-countdown-marker" style={{ background: cds[0].color || 'var(--accent)' }} title={cds[0].name} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ cursor, getDayStatus, onDayClick }) {
  const start = startOfWeek(cursor, { weekStartsOn: 1 })
  const end = endOfWeek(cursor, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })

  return (
    <div className="week-view">
      <div className="cal-grid week-grid">
        {days.map((day, i) => {
          const { today, selected, hasData, countdowns: cds } = getDayStatus(day)
          return (
            <button
              key={i}
              className={`cal-day week-day ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}`}
              onClick={() => onDayClick(day)}
            >
              <span className="cal-weekday-label">{WEEKDAYS[i]}</span>
              <span className="cal-day-num large">{format(day, 'd')}</span>
              <span className="cal-month-label">{format(day, 'MM月', { locale: zhCN })}</span>
              {hasData && <span className="cal-dot" />}
              {cds.map(cd => (
                <span key={cd.id} className="cal-countdown-tag" style={{ background: cd.color || 'var(--accent)' }}>
                  {cd.name}
                </span>
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function YearView({ cursor, getDayStatus, onDayClick }) {
  const months = eachMonthOfInterval({
    start: startOfYear(cursor),
    end: endOfYear(cursor)
  })

  return (
    <div className="year-view">
      {months.map(month => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
        const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
        const days = eachDayOfInterval({ start, end })
        const inMonth = (d) => isSameMonth(d, month)

        return (
          <div key={month.toISOString()} className="year-month">
            <div className="year-month-title">{format(month, 'MM月')}</div>
            <div className="year-grid">
              {WEEKDAYS.map(d => <span key={d} className="year-weekday">{d}</span>)}
              {days.map((day, i) => {
                const { today, selected, hasData } = getDayStatus(day)
                return (
                  <button
                    key={i}
                    className={`year-day ${inMonth(day) ? '' : 'other-month'} ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}`}
                    onClick={() => onDayClick(day)}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const COLORS = ['#7c6aff', '#34d399', '#f87171', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa']

function CountdownModal({ countdowns, onSave, onClose }) {
  const [list, setList] = useState(countdowns)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])

  const add = () => {
    if (!newName || !newDate) return
    const item = { id: Date.now(), name: newName, date: newDate, color: newColor }
    setList(prev => [...prev, item])
    setNewName('')
    setNewDate('')
  }

  const remove = (id) => setList(prev => prev.filter(c => c.id !== id))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">倒数日管理</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {list.map(cd => {
            const diff = Math.ceil((parseISO(cd.date) - new Date()) / (1000 * 60 * 60 * 24))
            const label = diff > 0 ? `还有 ${diff} 天` : diff === 0 ? '今天！' : `已过 ${-diff} 天`
            return (
              <div key={cd.id} className="countdown-row">
                <span className="countdown-dot" style={{ background: cd.color }} />
                <span className="cd-name">{cd.name}</span>
                <span className="cd-date">{cd.date}</span>
                <span className="cd-diff">{label}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => remove(cd.id)}>✕</button>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            className="input"
            placeholder="名称"
            style={{ flex: 1, minWidth: 100 }}
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            type="date"
            className="input"
            style={{ flex: 1, minWidth: 130 }}
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {COLORS.map(c => (
              <button
                key={c}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: c,
                  border: newColor === c ? '2px solid white' : '2px solid transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={add}>添加</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => { onSave(list); onClose() }}>保存</button>
        </div>
      </div>
    </div>
  )
}
