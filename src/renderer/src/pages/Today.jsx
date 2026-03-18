import React, { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO, addDays, subDays, isToday, isValid } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import CodeMirrorEditor from '../components/CodeMirrorEditor'
import './Today.css'

// Save status enum
const STATUS = {
  SAVED: 'saved',
  UNSAVED: 'unsaved',
  SAVING: 'saving',
  FAILED: 'failed',
  IDLE: 'idle'
}

export default function Today() {
  const { sections, readDayData, writeDayData, refreshDates, selectedDate, setSelectedDate, showToast } = useApp()

  const [data, setData] = useState({})
  const [saveStatus, setSaveStatus] = useState(STATUS.IDLE)
  const [loading, setLoading] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [jumpInput, setJumpInput] = useState('')
  const [fullScreenSectionId, setFullScreenSectionId] = useState(null)
  const saveTimerRef = useRef(null)
  const pendingDataRef = useRef(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // Load data when date changes
  useEffect(() => {
    setLoading(true)
    setSaveStatus(STATUS.IDLE)
    setFullScreenSectionId(null) // Exit full screen on date change
    readDayData(dateStr).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [dateStr, readDayData])

  // Global escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && fullScreenSectionId) {
        setFullScreenSectionId(null)
        // Set focus back inside the editor shortly after exiting
        setTimeout(() => {
          const editorShell = document.querySelector('.section-card:not(.fullscreen-active-parent) .cm-content')
          if (editorShell) editorShell.focus()
        }, 50)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullScreenSectionId])

  const scheduleSave = useCallback((newData) => {
    pendingDataRef.current = newData
    setSaveStatus(STATUS.UNSAVED)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus(STATUS.SAVING)
      const result = await writeDayData(dateStr, pendingDataRef.current)
      if (result.ok) {
        setSaveStatus(STATUS.SAVED)
        refreshDates()
        setTimeout(() => setSaveStatus(STATUS.IDLE), 2000)
      } else {
        setSaveStatus(STATUS.FAILED)
      }
    }, 800)
  }, [dateStr, writeDayData, refreshDates])

  const handleManualSave = useCallback(() => {
    if (pendingDataRef.current) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      setSaveStatus(STATUS.SAVING)
      writeDayData(dateStr, pendingDataRef.current).then(result => {
        if (result.ok) {
          setSaveStatus(STATUS.SAVED)
          refreshDates()
          showToast('已保存更改', 'success', 2000)
          setTimeout(() => setSaveStatus(STATUS.IDLE), 2000)
        } else {
          setSaveStatus(STATUS.FAILED)
          showToast('保存失败', 'error')
        }
      })
    } else {
      showToast('暂无需要保存的更改', 'info', 1000)
    }
  }, [dateStr, writeDayData, refreshDates, showToast])

  const handleChange = useCallback((sectionId, value) => {
    setData(prev => {
      const next = {
        ...prev,
        [sectionId]: {
          value,
          updatedAt: new Date().toISOString()
        }
      }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const goTo = (date) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      if (pendingDataRef.current) {
        writeDayData(dateStr, pendingDataRef.current)
      }
    }
    setSelectedDate(date)
  }

  const visibleSections = sections.filter(sec => {
    if (sec.resident) return true
    const entry = data[sec.id]
    const hasValue = entry && (
      sec.type === 'text' ? entry.value && entry.value.trim() !== '' : entry.value !== undefined && entry.value !== ''
    )
    return hasValue
  })

  // Add sections for today that aren't resident but user might want to add
  const availableToAdd = sections.filter(sec => {
    if (sec.resident) return false
    const entry = data[sec.id]
    const hasValue = entry && (
      sec.type === 'text' ? entry.value && entry.value.trim() !== '' : entry.value !== undefined && entry.value !== ''
    )
    return !hasValue
  })

  const formatDateDisplay = () => {
    if (isToday(selectedDate)) return '今日'
    return format(selectedDate, 'MM月dd日 EEEE', { locale: zhCN })
  }

  const handleJump = (e) => {
    e.preventDefault()
    const parsed = parseISO(jumpInput)
    if (isValid(parsed)) {
      goTo(parsed)
      setShowDatePicker(false)
      setJumpInput('')
    }
  }

  const statusLabel = {
    [STATUS.IDLE]: null,
    [STATUS.SAVED]: { text: '已保存', cls: 'status-saved' },
    [STATUS.UNSAVED]: { text: '未保存', cls: 'status-unsaved' },
    [STATUS.SAVING]: { text: '保存中...', cls: 'status-saving' },
    [STATUS.FAILED]: { text: '保存失败', cls: 'status-failed' },
  }[saveStatus]

  return (
    <div className="today-page">
      {/* Header */}
      <div className="today-header">
        <div className="today-nav">
          <button className="btn btn-ghost btn-icon" onClick={() => goTo(subDays(selectedDate, 1))} title="前一天">
            ←
          </button>
          <div className="today-date-group">
            <div className="today-date" onClick={() => setShowDatePicker(v => !v)}>
              <span className="today-date-main">{formatDateDisplay()}</span>
              <span className="today-date-sub">{format(selectedDate, 'yyyy年MM月dd日')}</span>
            </div>
            {showDatePicker && (
              <form className="date-jump-form" onSubmit={handleJump}>
                <input
                  type="date"
                  className="input"
                  value={jumpInput}
                  onChange={e => setJumpInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Escape' && setShowDatePicker(false)}
                />
                <button type="submit" className="btn btn-primary btn-sm">跳转</button>
              </form>
            )}
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => goTo(addDays(selectedDate, 1))}
            title="后一天"
          >
            →
          </button>
          {!isToday(selectedDate) && (
            <button 
              className="btn btn-primary btn-sm" 
              style={{ marginLeft: 8, borderRadius: 'var(--radius-full)' }} 
              onClick={() => goTo(new Date())}
            >
              ✦ 回到今日
            </button>
          )}
        </div>
        <div className="today-header-right">
          {statusLabel && (
            <span className={`save-status ${statusLabel.cls}`}>
              {saveStatus === STATUS.SAVING && <span className="status-dot saving" />}
              {saveStatus === STATUS.SAVED && <span className="status-dot saved" />}
              {saveStatus === STATUS.UNSAVED && <span className="status-dot unsaved" />}
              {saveStatus === STATUS.FAILED && <span className="status-dot failed" />}
              {statusLabel.text}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="today-content">
        {loading ? (
          <div className="today-skeleton">
            {[1, 2].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton" style={{ height: 20, width: '30%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 80 }} />
              </div>
            ))}
          </div>
        ) : visibleSections.length === 0 && sections.length > 0 ? (
          <div className="today-empty-day">
            <div className="empty-state">
              <span className="empty-state-icon">📋</span>
              <p className="empty-state-title">这天还没有记录</p>
              <p className="empty-state-desc">所有常驻版块已显示，点击下方「+」添加非常驻版块的记录</p>
            </div>
          </div>
        ) : (
          <div className="sections-grid">
            {visibleSections.map((sec, i) => (
              <SectionCard
                key={sec.id}
                section={sec}
                value={data[sec.id]?.value ?? (sec.type === 'text' ? '' : '')}
                onChange={(val) => handleChange(sec.id, val)}
                animationDelay={i * 50}
                isFullScreen={fullScreenSectionId === sec.id}
                onToggleFullScreen={() => setFullScreenSectionId(prev => prev === sec.id ? null : sec.id)}
                onSave={handleManualSave}
              />
            ))}
          </div>
        )}

        {/* Add non-resident section for today */}
        {availableToAdd.length > 0 && (
          <div className="today-add-section">
            <span className="add-section-label">添加记录</span>
            <div className="add-section-list">
              {availableToAdd.map(sec => (
                <button
                  key={sec.id}
                  className="add-section-btn"
                  onClick={() => handleChange(sec.id, sec.type === 'text' ? '' : '0')}
                >
                  + {sec.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionCard({ section, value, onChange, animationDelay, isFullScreen, onToggleFullScreen, onSave }) {
  return (
    <div
      className={`section-card ${isFullScreen ? 'fullscreen-active-parent' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="section-card-header">
        <span className="section-card-title">{section.name}</span>
        <span className={`section-type-badge ${section.resident ? 'resident' : 'activated'}`}>
          {section.resident ? '常驻' : '激发'}
        </span>
      </div>
      <div className={`section-card-body ${section.type === 'text' ? 'text-editor-body' : ''}`}>
        {section.type === 'text' ? (
          <CodeMirrorEditor
            value={value}
            onChange={onChange}
            placeholder={`记录你的${section.name}...`}
            minHeight={isFullScreen ? "60vh" : "120px"}
            isFullScreen={isFullScreen}
            onToggleFullScreen={onToggleFullScreen}
            onSave={onSave}
          />
        ) : (
          <NumberInput
            value={value}
            unit={section.unit}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  )
}

function NumberInput({ value, unit, onChange }) {
  const numVal = value === '' ? '' : String(value)

  const handleChange = (e) => {
    const v = e.target.value
    if (v === '' || /^-?\d*\.?\d*$/.test(v)) onChange(v)
  }

  const increment = (delta) => {
    const n = parseFloat(numVal) || 0
    onChange(String(parseFloat((n + delta).toFixed(4))))
  }

  return (
    <div className="number-input-wrap">
      <button className="num-btn" onClick={() => increment(-1)}>−</button>
      <input
        className="input number-input selectable"
        type="text"
        inputMode="decimal"
        value={numVal}
        onChange={handleChange}
        placeholder="0"
      />
      <button className="num-btn" onClick={() => increment(1)}>+</button>
      {unit && <span className="number-unit">{unit}</span>}
    </div>
  )
}
