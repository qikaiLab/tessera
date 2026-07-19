import React, { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO, addDays, subDays, isToday, isValid } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import TiptapEditor from '../components/TiptapEditor'
import NotesDrawer from '../components/NotesDrawer'
import SaveStatusBadge from '../components/SaveStatusBadge'
import {
  editMenuItems,
  focusEditableTarget,
  getEditableSelectionState,
  isEditableMenuTarget,
  separator,
  showContextMenu,
  useContextMenuCommand
} from '../utils/contextMenu'
import { FULLSCREEN_EDITOR_SHORTCUT_LABEL } from '../utils/editorShortcuts'
import './Today.css'

// Save status enum
const STATUS = {
  SAVED: 'saved',
  UNSAVED: 'unsaved',
  SAVING: 'saving',
  FAILED: 'failed',
  IDLE: 'idle'
}

const NOTES_DRAWER_MIN = 270
const NOTES_DRAWER_MAX = 620
const NOTES_DRAWER_DEFAULT = 430

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const NUMBER_DEFAULT_MODE_CARRY = 'carry'

const getNumberDefaultMode = (section) => {
  return section?.numberDefaultMode === NUMBER_DEFAULT_MODE_CARRY ? NUMBER_DEFAULT_MODE_CARRY : 'manual'
}

const hasStoredValue = (entry) => {
  return entry?.value !== undefined && entry?.value !== null && String(entry.value).trim() !== ''
}

const isNumericText = (value) => /^-?\d+(\.\d+)?$/.test(String(value || '').trim())

export default function Today() {
  const navigate = useNavigate()
  const {
    sections, datesWithData, readDayData, writeDayData, selectedDate, setSelectedDate, showToast,
    registerPendingFlush, unregisterPendingFlush
  } = useApp()

  const [data, setData] = useState({})
  const [numberDefaults, setNumberDefaults] = useState({})
  const [saveStatus, setSaveStatus] = useState(STATUS.IDLE)
  const [loading, setLoading] = useState(true)
  const [transitioningDate, setTransitioningDate] = useState(false)
  const [dateLeaving, setDateLeaving] = useState(false)
  const [dateLeavingDir, setDateLeavingDir] = useState('jump')
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [dateTransitionDir, setDateTransitionDir] = useState('jump')
  const [returningToToday, setReturningToToday] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [jumpInput, setJumpInput] = useState('')
  const [fullScreenSectionId, setFullScreenSectionId] = useState(null)
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false)
  const [notesDrawerMounted, setNotesDrawerMounted] = useState(false)
  const [notesDrawerWidth, setNotesDrawerWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('mototrace_today_notes_drawer_width') || '', 10)
    return Number.isFinite(saved) ? clamp(saved, NOTES_DRAWER_MIN, NOTES_DRAWER_MAX) : NOTES_DRAWER_DEFAULT
  })
  // Task 2: track sections manually added by user this session (so empty text
  // sections don't immediately disappear after clicking "+")
  const [manuallyAdded, setManuallyAdded] = useState(new Set())
  const saveTimerRef = useRef(null)
  const pendingDataRef = useRef(null)
  const hasLoadedOnceRef = useRef(false)
  const loadSeqRef = useRef(0)
  const dateSwitchTimerRef = useRef(null)
  const returnTodayTimerRef = useRef(null)
  const suppressNextLoadTransitionRef = useRef(false)
  // Fix #11: Track escape-handler setTimeout for cleanup
  const escapeTimeoutRef = useRef(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const datesWithDataRef = useRef(datesWithData)
  datesWithDataRef.current = datesWithData
  // Keep a ref to dateStr so flush can use latest value
  const dateStrRef = useRef(dateStr)
  dateStrRef.current = dateStr

  const findRecentNumberValue = useCallback(async (targetDateStr, sectionId) => {
    const candidates = datesWithDataRef.current
      .filter(d => d < targetDateStr)
      .sort((a, b) => b.localeCompare(a))

    for (const d of candidates) {
      const dayData = await readDayData(d)
      const entry = dayData[sectionId]
      if (hasStoredValue(entry)) {
        return String(entry.value)
      }
    }

    return '0'
  }, [readDayData])

  const buildNumberDefaults = useCallback(async (targetDateStr, loadedData) => {
    const defaults = {}

    for (const section of sections) {
      if (section.type !== 'number' || hasStoredValue(loadedData[section.id])) continue

      defaults[section.id] = getNumberDefaultMode(section) === NUMBER_DEFAULT_MODE_CARRY
        ? await findRecentNumberValue(targetDateStr, section.id)
        : '0'
    }

    return defaults
  }, [findRecentNumberValue, sections])

  // Load data when date changes
  useEffect(() => {
    const seq = loadSeqRef.current + 1
    loadSeqRef.current = seq
    const hasLoadedOnce = hasLoadedOnceRef.current
    const shouldSuppressLoadTransition = suppressNextLoadTransitionRef.current
    suppressNextLoadTransitionRef.current = false
    let skeletonTimer = null

    setLoading(!hasLoadedOnce)
    setTransitioningDate(hasLoadedOnce && !shouldSuppressLoadTransition)
    setShowSkeleton(false)
    setSaveStatus(STATUS.IDLE)
    setFullScreenSectionId(null) // Exit full screen on date change
    setManuallyAdded(new Set())  // Task 2: clear manual additions on date change
    setNumberDefaults({})

    if (!hasLoadedOnce) {
      skeletonTimer = setTimeout(() => setShowSkeleton(true), 180)
    }

    readDayData(dateStr)
      .then(async d => {
        const defaults = await buildNumberDefaults(dateStr, d)
        if (loadSeqRef.current !== seq) return
        setData(d)
        setNumberDefaults(defaults)
      })
      .catch(error => {
        console.error('Failed to load day data:', error)
        if (loadSeqRef.current === seq) {
          showToast('读取记录失败', 'error')
        }
      })
      .finally(() => {
        if (loadSeqRef.current !== seq) return
        hasLoadedOnceRef.current = true
        setLoading(false)
        setTransitioningDate(false)
        setShowSkeleton(false)
      })

    return () => {
      if (skeletonTimer) clearTimeout(skeletonTimer)
    }
  }, [dateStr, readDayData, showToast, buildNumberDefaults])

  useEffect(() => {
    return () => {
      if (dateSwitchTimerRef.current) clearTimeout(dateSwitchTimerRef.current)
      if (returnTodayTimerRef.current) clearTimeout(returnTodayTimerRef.current)
    }
  }, [])

  // Global escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && fullScreenSectionId) {
        setFullScreenSectionId(null)
        // Fix #11: Track the timeout and clear on cleanup
        escapeTimeoutRef.current = setTimeout(() => {
          const editorEl = document.querySelector('.section-card:not(.fullscreen-active-parent) .ProseMirror')
          if (editorEl) editorEl.focus()
        }, 50)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // Fix #11: Clear pending timeout on cleanup
      if (escapeTimeoutRef.current) {
        clearTimeout(escapeTimeoutRef.current)
        escapeTimeoutRef.current = null
      }
    }
  }, [fullScreenSectionId])

  const scheduleSave = useCallback((newData) => {
    pendingDataRef.current = newData
    setSaveStatus(STATUS.UNSAVED)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus(STATUS.SAVING)
      const dataToSave = pendingDataRef.current
      saveTimerRef.current = null
      pendingDataRef.current = null
      
      const result = await writeDayData(dateStrRef.current, dataToSave)
      if (result.ok) {
        setSaveStatus(STATUS.SAVED)
        // Fix #1: Removed refreshDates() call — writeDayData already updates datesWithData incrementally
        setTimeout(() => setSaveStatus(STATUS.IDLE), 2000)
      } else {
        setSaveStatus(STATUS.FAILED)
      }
    }, 800)
  }, [writeDayData])

  // Fix #8: Register flush callback for graceful shutdown
  useEffect(() => {
    const flushTodayData = async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (pendingDataRef.current) {
        const dataToSave = pendingDataRef.current
        pendingDataRef.current = null
        await writeDayData(dateStrRef.current, dataToSave)
      }
    }
    registerPendingFlush('today', flushTodayData)
    return () => unregisterPendingFlush('today')
  }, [writeDayData, registerPendingFlush, unregisterPendingFlush])

  const handleManualSave = useCallback(() => {
    if (pendingDataRef.current) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      setSaveStatus(STATUS.SAVING)
      const dataToSave = pendingDataRef.current
      pendingDataRef.current = null
      writeDayData(dateStr, dataToSave).then(result => {
        if (result.ok) {
          setSaveStatus(STATUS.SAVED)
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
  }, [dateStr, writeDayData, showToast])

  const handleChange = useCallback((sectionId, value) => {
    setData(prev => {
      // value can be a JSON object (Tiptap) or a number string
      const serialized = (typeof value === 'object' && value !== null)
        ? JSON.stringify(value)
        : value
      const next = {
        ...prev,
        [sectionId]: {
          value: serialized,
          updatedAt: new Date().toISOString()
        }
      }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const clearSection = useCallback((sectionId) => {
    setData(prev => {
      const next = { ...prev }
      delete next[sectionId]
      scheduleSave(next)
      return next
    })
    setManuallyAdded(prev => {
      if (!prev.has(sectionId)) return prev
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
    showToast('已清空记录', 'success', 1200)
  }, [scheduleSave, showToast])

  const handleSectionContextMenu = useCallback((event, section) => {
    if (isEditableMenuTarget(event.target)) return

    showContextMenu(event, [
      { id: 'clear', label: '清空' },
      separator,
      { id: 'edit-settings', label: '在设置中编辑' }
    ], {
      scope: 'today-section',
      sectionId: section.id
    })
  }, [])

  useContextMenuCommand('today-section', useCallback((id, context) => {
    if (!context?.sectionId) return
    if (id === 'clear') {
      clearSection(context.sectionId)
      return
    }
    if (id === 'edit-settings') {
      navigate('/settings')
    }
  }, [clearSection, navigate]))

  const getSectionDisplayValue = useCallback((section) => {
    const stored = data[section.id]?.value
    if (stored !== undefined && stored !== null) return stored
    if (section.type === 'number') return numberDefaults[section.id] ?? '0'
    return ''
  }, [data, numberDefaults])

  // Fix #3: goTo() now catches write errors and shows user feedback
  const goTo = (date) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      if (pendingDataRef.current) {
        const dataToSave = pendingDataRef.current
        pendingDataRef.current = null
        writeDayData(dateStr, dataToSave).catch(e => {
          console.error('Failed to save on date change:', e)
          showToast('切换日期时保存失败', 'error')
        })
      }
    }
    pendingDataRef.current = null
    const currentTime = selectedDate.getTime()
    const nextTime = date.getTime()
    if (nextTime === currentTime) return
    const nextDir = nextTime > currentTime ? 'next' : 'prev'
    setDateLeavingDir(nextDir)
    setDateLeaving(true)
    if (dateSwitchTimerRef.current) clearTimeout(dateSwitchTimerRef.current)
    dateSwitchTimerRef.current = setTimeout(() => {
      dateSwitchTimerRef.current = null
      suppressNextLoadTransitionRef.current = true
      setDateTransitionDir(nextDir)
      setSelectedDate(date)
      setDateLeaving(false)
    }, 140)
  }

  const visibleSections = sections.filter(sec => {
    if (sec.resident) return true
    // Task 2: show section if manually added this session (even if empty)
    if (manuallyAdded.has(sec.id)) return true
    const entry = data[sec.id]
    const hasValue = entry && (
      sec.type === 'text' ? entry.value && entry.value.trim() !== '' : hasStoredValue(entry)
    )
    return hasValue
  })

  // Add sections for today that aren't resident but user might want to add
  const availableToAdd = sections.filter(sec => {
    if (sec.resident) return false
    // Task 2: exclude already manually added sections
    if (manuallyAdded.has(sec.id)) return false
    const entry = data[sec.id]
    const hasValue = entry && (
      sec.type === 'text' ? entry.value && entry.value.trim() !== '' : hasStoredValue(entry)
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

  const handleReturnToToday = () => {
    if (returningToToday) return
    setReturningToToday(true)
    goTo(new Date())
    if (returnTodayTimerRef.current) clearTimeout(returnTodayTimerRef.current)
    returnTodayTimerRef.current = setTimeout(() => {
      returnTodayTimerRef.current = null
      setReturningToToday(false)
    }, 360)
  }

  const startNotesDrawerResize = (event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = notesDrawerWidth
    document.body.classList.add('is-resizing')

    const handleMove = (moveEvent) => {
      const nextWidth = clamp(startWidth - (moveEvent.clientX - startX), NOTES_DRAWER_MIN, NOTES_DRAWER_MAX)
      setNotesDrawerWidth(nextWidth)
      localStorage.setItem('mototrace_today_notes_drawer_width', String(nextWidth))
    }

    const handleUp = () => {
      document.body.classList.remove('is-resizing')
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const toggleNotesDrawer = () => {
    if (notesDrawerOpen) {
      setNotesDrawerOpen(false)
      return
    }
    setNotesDrawerMounted(true)
    setNotesDrawerOpen(true)
  }

  const handleNotesDrawerAnimationEnd = () => {
    if (!notesDrawerOpen) {
      setNotesDrawerMounted(false)
    }
  }

  return (
    <div className="today-page">
      <div className={`today-main-split ${notesDrawerMounted ? 'has-notes-drawer' : ''}`}>
        <div className="today-record-pane">
          {/* Header */}
          <div className="today-header">
            <div className="today-nav">
              <button className="btn btn-ghost btn-icon" onClick={() => goTo(subDays(selectedDate, 1))} title="前一天">
                ←
              </button>
              <div className="today-date-group">
                <div className="today-date" onClick={() => setShowDatePicker(v => !v)}>
                  <div key={dateStr} className={`today-date-motion date-motion-${dateTransitionDir}`}>
                    <span className="today-date-main">{formatDateDisplay()}</span>
                    <span className="today-date-sub">{format(selectedDate, 'yyyy年MM月dd日')}</span>
                  </div>
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
              {(!isToday(selectedDate) || returningToToday) && (
                <button 
                  className={`btn btn-primary btn-sm today-return-button ${returningToToday ? 'is-leaving' : ''}`}
                  onClick={handleReturnToToday}
                  aria-disabled={returningToToday}
                >
                  ✦ 回到今日
                </button>
              )}
            </div>
            <div className="today-header-right">
              <button
                className={`today-notes-toggle ${notesDrawerOpen ? 'active' : ''}`}
                onClick={toggleNotesDrawer}
                title={notesDrawerOpen ? '收起便签抽屉' : '打开便签抽屉'}
                aria-label={notesDrawerOpen ? '收起便签抽屉' : '打开便签抽屉'}
              >
                <span className="today-notes-toggle-mark">{notesDrawerOpen ? '›' : '‹'}</span>
              </button>
              <SaveStatusBadge status={saveStatus} />
            </div>
          </div>

          {/* Content */}
          <div className={`today-content ${transitioningDate ? 'is-date-transitioning' : ''} ${dateLeaving ? `is-date-leaving date-leaving-${dateLeavingDir}` : ''}`}>
            {loading && showSkeleton ? (
              <div className="today-skeleton">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton" style={{ height: 20, width: '30%', marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 80 }} />
                  </div>
                ))}
              </div>
            ) : loading ? (
              <div className="today-loading-quiet" />
            ) : visibleSections.length === 0 && sections.length > 0 ? (
              <div className="today-empty-day">
                <div className="empty-state">
                  <span className="empty-state-icon">📋</span>
                  <p className="empty-state-title">这天还没有记录</p>
                  <p className="empty-state-desc">所有常驻版块已显示，点击下方「+」添加非常驻版块的记录</p>
                </div>
              </div>
            ) : (
              <div key={`sections-${dateStr}`} className="sections-grid">
                {visibleSections.map((sec, i) => (
                  <SectionCard
                    key={sec.id}
                    section={sec}
                    value={getSectionDisplayValue(sec)}
                    onChange={(val) => handleChange(sec.id, val)}
                    onContextMenu={(event) => handleSectionContextMenu(event, sec)}
                    onUseRecentNumberValue={() => findRecentNumberValue(dateStr, sec.id)}
                    showToast={showToast}
                    animationDelay={i * 50}
                    dateTransitionDir={dateTransitionDir}
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
                      onClick={() => {
                        // Task 2: register as manually added so it stays visible
                        setManuallyAdded(prev => new Set([...prev, sec.id]))
                        if (sec.type === 'number') {
                          handleChange(sec.id, getSectionDisplayValue(sec))
                        }
                      }}
                    >
                      + {sec.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {notesDrawerMounted && (
          <NotesDrawer
            dateStr={dateStr}
            width={notesDrawerWidth}
            onResizeStart={startNotesDrawerResize}
            closing={!notesDrawerOpen}
            onAnimationEnd={handleNotesDrawerAnimationEnd}
          />
        )}
      </div>
    </div>
  )
}

function SectionCard({
  section,
  value,
  onChange,
  onContextMenu,
  onUseRecentNumberValue,
  showToast,
  animationDelay,
  dateTransitionDir,
  isFullScreen,
  onToggleFullScreen,
  onSave
}) {
  const [charCount, setCharCount] = useState(0)
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('mototrace_font_size') || '14', 10)
  })

  const handleFontSizeChange = (size) => {
    setFontSize(size)
    localStorage.setItem('mototrace_font_size', String(size))
  }

  // Parse persisted JSON string back to object for Tiptap
  const parsedValue = React.useMemo(() => {
    if (section.type !== 'text') return value
    if (!value || value === '') return null
    if (typeof value === 'object') return value
    try {
      return JSON.parse(value)
    } catch {
      // Legacy plain-text fallback: wrap in paragraph node
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }]
      }
    }
  }, [value, section.type])

  if (section.type === 'number') {
    return (
      <div
        className={`section-card number-card date-card-${dateTransitionDir}`}
        style={{ animationDelay: `${animationDelay}ms` }}
        onContextMenu={onContextMenu}
      >
        <div className="number-card-content">
          <div className="number-card-left">
            <span className="section-card-title">{section.name}</span>
            <span className={`section-type-badge ${section.resident ? 'resident' : 'activated'}`}>
              {section.resident ? '常驻' : '激发'}
            </span>
          </div>
          <div className="number-card-right">
            <NumberInput
              sectionId={section.id}
              value={value}
              unit={section.unit}
              onChange={onChange}
              onUseRecentValue={onUseRecentNumberValue}
              showToast={showToast}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`section-card date-card-${dateTransitionDir} ${isFullScreen ? 'fullscreen-active-parent' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onContextMenu={onContextMenu}
    >
      <div className="section-card-header">
        <div className="section-card-header-left">
          <span className="section-card-title">{section.name}</span>
          <span className={`section-type-badge ${section.resident ? 'resident' : 'activated'}`}>
            {section.resident ? '常驻' : '激发'}
          </span>
        </div>
        {!isFullScreen && (
          <div className="section-card-header-right">
            <span className="char-count-badge">{charCount} 字</span>
            <div className="card-font-controls">
              <button
                className="btn btn-ghost btn-xs font-ctrl-btn"
                onClick={() => handleFontSizeChange(Math.max(12, fontSize - 1))}
                title="缩小字体"
              >
                A−
              </button>
              <span className="font-ctrl-label">{fontSize}</span>
              <button
                className="btn btn-ghost btn-xs font-ctrl-btn"
                onClick={() => handleFontSizeChange(Math.min(24, fontSize + 1))}
                title="放大字体"
              >
                A+
              </button>
            </div>
            {onToggleFullScreen && (
              <button
                className="btn btn-ghost btn-xs btn-icon fullscreen-btn"
                onClick={onToggleFullScreen}
                title={`全屏写作 (${FULLSCREEN_EDITOR_SHORTCUT_LABEL})`}
                aria-label={`进入全屏写作，快捷键 ${FULLSCREEN_EDITOR_SHORTCUT_LABEL}`}
              >
                ⛶
              </button>
            )}
          </div>
        )}
      </div>
      <div className="section-card-body text-editor-body">
        <TiptapEditor
          value={parsedValue}
          onChange={onChange}
          placeholder={`记录你的${section.name}...`}
          isFullScreen={isFullScreen}
          onToggleFullScreen={onToggleFullScreen}
          onSave={onSave}
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
          onCharCountChange={setCharCount}
        />
      </div>
    </div>
  )
}

function NumberInput({ sectionId, value, unit, onChange, onUseRecentValue, showToast }) {
  const numVal = value === '' ? '' : String(value)

  const handleChange = (e) => {
    const v = e.target.value
    if (v === '' || /^-?\d*\.?\d*$/.test(v)) onChange(v)
  }

  const increment = (delta) => {
    const n = parseFloat(numVal) || 0
    onChange(String(parseFloat((n + delta).toFixed(4))))
  }

  useContextMenuCommand('today-number', useCallback(async (id, context) => {
    if (context?.sectionId !== sectionId) return

    if (id === 'reset-zero') {
      onChange('0')
      return
    }

    if (id === 'use-recent') {
      const recentValue = await onUseRecentValue?.()
      onChange(String(recentValue ?? '0'))
      return
    }

    if (id === 'copy-value') {
      window.api?.clipboard?.writeText?.(numVal || '0')
      showToast?.('已复制数值', 'success', 1000)
      return
    }

    if (id === 'paste-number') {
      const text = window.api?.clipboard?.readText?.() || ''
      const trimmed = text.trim()
      if (isNumericText(trimmed)) {
        onChange(trimmed)
      }
    }
  }, [numVal, onChange, onUseRecentValue, sectionId, showToast]))

  const handleContextMenu = async (event) => {
    const clipboardText = window.api?.clipboard?.readText?.() || ''
    const canPasteNumber = isNumericText(clipboardText)
    const selectionState = getEditableSelectionState(event.target)
    const isInputMenu = Boolean(selectionState?.target?.matches?.('input, textarea'))
    if (isInputMenu) focusEditableTarget(selectionState.target)

    const textMenuItems = isInputMenu
      ? [
          ...editMenuItems({
            canUndo: selectionState.canEdit,
            canRedo: selectionState.canEdit,
            canCut: selectionState.canCut,
            canCopy: selectionState.canCopy,
            canPaste: selectionState.canPaste && canPasteNumber,
            canSelectAll: selectionState.canSelectAll
          }),
          separator
        ]
      : []

    showContextMenu(event, [
      ...textMenuItems,
      { id: 'reset-zero', label: '重置为 0' },
      { id: 'use-recent', label: '使用最近一次数值' },
      separator,
      { id: 'copy-value', label: '复制数值' },
      { id: 'paste-number', label: '粘贴', visible: !isInputMenu && canPasteNumber }
    ], {
      scope: 'today-number',
      sectionId
    })
  }

  return (
    <div className="number-input-wrap" onContextMenu={handleContextMenu}>
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
