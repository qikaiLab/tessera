import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, addYears, subYears,
  parseISO, startOfYear, endOfYear, eachMonthOfInterval
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import './Calendar.css'

const VIEWS = ['month', 'week', 'year']
const VIEW_LABELS = { month: '月', week: '周', year: '年' }

export default function Calendar() {
  const navigate = useNavigate()
  const { datesWithData, selectedDate, setSelectedDate, countdowns, saveCountdowns, confirm } = useApp()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(new Date())
  const [showCountdownModal, setShowCountdownModal] = useState(false)

  const datesSet = useMemo(() => new Set(datesWithData), [datesWithData])

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
        <button className="cal-nav-arrow" onClick={() => navigate_(-1)} aria-label="上一页">‹</button>
        <button className="cal-today-btn btn btn-primary btn-sm" onClick={() => setCursor(new Date())}>
          今日
        </button>
        <span className="cal-header-title">{headerTitle()}</span>
        <button className="cal-nav-arrow" onClick={() => navigate_(1)} aria-label="下一页">›</button>
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
          confirm={confirm}
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
                <span
                  className="cal-countdown-tag cal-countdown-tag--mini"
                  style={{ background: cds[0].color || 'var(--accent)' }}
                  title={cds.map(c => c.name).join(', ')}
                >
                  {cds[0].name.length > 4 ? cds[0].name.slice(0, 3) + '…' : cds[0].name}
                </span>
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
                const { today, selected, hasData, countdowns: cds } = getDayStatus(day)
                const hasCd = cds && cds.length > 0
                return (
                  <button
                    key={i}
                    className={`year-day ${inMonth(day) ? '' : 'other-month'} ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${hasData ? 'has-data' : ''} ${hasCd ? 'has-countdown' : ''}`}
                    onClick={() => onDayClick(day)}
                    title={hasCd ? cds.map(c => `⏱ ${c.name}`).join('\n') : undefined}
                    style={hasCd ? { '--cd-color': cds[0].color || 'var(--accent)' } : {}}
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

function CountdownModal({ countdowns, onSave, onClose, confirm }) {
  const [list, setList] = useState(countdowns)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [addError, setAddError] = useState('') // 任务6: 添加错误提示

  const add = () => {
    // 任务6: 明确校验并提示缺失字段
    if (!newName && !newDate) {
      setAddError('请填写名称和日期')
      return
    }
    if (!newName) {
      setAddError('请填写倒数日名称')
      return
    }
    if (!newDate) {
      setAddError('请选择目标日期')
      return
    }
    setAddError('')
    const item = { id: Date.now(), name: newName, date: newDate, color: newColor }
    setList(prev => [...prev, item])
    setNewName('')
    setNewDate('')
  }

  const remove = (id) => setList(prev => prev.filter(c => c.id !== id))

  // 任务6: 保存前检查是否有未提交的条目
  const handleSave = async () => {
    if (newName || newDate) {
      // 用户有未完成的填写，提示是否先添加
      const msg = newName && newDate
        ? `您填写了「${newName}」但还未点击「添加」，是否先将其添加再保存？`
        : '您有未完成的倒数日信息还未添加，是否直接保存（填写内容将被丢弃）？'
      const confirmed = await confirm({
        message: msg,
        title: '保存确认',
        confirmText: '添加并保存',
        cancelText: '直接保存'
      })
      if (confirmed) {
        if (newName && newDate) {
          const item = { id: Date.now(), name: newName, date: newDate, color: newColor }
          onSave([...list, item])
        } else {
          // 有一个字段，提示继续填写
          setAddError(!newName ? '请填写倒数日名称' : '请选择目标日期')
          return
        }
      } else {
        onSave(list)
      }
      onClose()
      return
    }
    onSave(list)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">倒数日管理</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {list.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              还没有倒数日，在下方添加第一个吧 ↓
            </p>
          )}
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

        {/* 任务6: 添加区域 */}
        <div style={{ background: 'var(--bg-surface-2)', borderRadius: 10, padding: '12px', marginBottom: 12, border: addError ? '1px solid var(--error)' : '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            添加新倒数日
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: addError ? 8 : 0 }}>
            <input
              className="input"
              placeholder="名称（必填）"
              style={{ flex: 1, minWidth: 100, borderColor: addError && !newName ? 'var(--error)' : undefined }}
              value={newName}
              onChange={e => { setNewName(e.target.value); setAddError('') }}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <input
              type="date"
              className="input"
              style={{ flex: 1, minWidth: 130, borderColor: addError && !newDate ? 'var(--error)' : undefined }}
              value={newDate}
              onChange={e => { setNewDate(e.target.value); setAddError('') }}
            />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: c,
                    border: newColor === c ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer', boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={add}>添加</button>
          </div>
          {addError && (
            <div style={{ fontSize: 12, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⚠</span> {addError}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}

