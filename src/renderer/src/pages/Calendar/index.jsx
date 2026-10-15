import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { endOfWeek, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import Presence from '../../components/Presence'
import { describeCountdown } from '../../utils/countdowns'
import { useSlidingThumb } from '../../utils/useSlidingThumb'
import CountdownModal from './CountdownModal'
import MonthView from './MonthView'
import WeekView from './WeekView'
import YearView from './YearView'
import { periodKey } from './calendarViews'
import { useCalendarNavigation } from './useCalendarNavigation'
import './Calendar.css'

const VIEWS = ['month', 'week', 'year']
const VIEW_LABELS = { month: '月', week: '周', year: '年' }
const VIEW_COMPONENTS = { month: MonthView, week: WeekView, year: YearView }

function headerTitle(view, cursor) {
  if (view === 'month') return format(cursor, 'yyyy年MM月', { locale: zhCN })
  if (view === 'week') {
    const start = startOfWeek(cursor, { weekStartsOn: 1 })
    const end = endOfWeek(cursor, { weekStartsOn: 1 })
    return `${format(start, 'MM月dd日')} — ${format(end, 'MM月dd日')}`
  }
  return format(cursor, 'yyyy年', { locale: zhCN })
}

function CountdownLegend({ countdowns }) {
  return (
    <div className="countdown-legend">
      {countdowns.map(cd => (
        <div key={cd.id} className="countdown-item">
          <span className="countdown-dot" style={{ background: cd.color || 'var(--accent)' }} />
          <span className="countdown-name">{cd.name}</span>
          <span className="countdown-diff">{describeCountdown(cd.date)}</span>
        </div>
      ))}
    </div>
  )
}

// The calendar: month, week and year views showing which days have records and which carry a
// countdown; clicking a day opens it on the record page.
export default function Calendar() {
  const tabsThumbRef = useSlidingThumb()
  const navigate = useNavigate()
  const { datesWithData, selectedDate, setSelectedDate, countdowns, saveCountdowns, confirm } = useApp()
  const { view, setView, cursor, motion, goToToday, step } = useCalendarNavigation()
  const [showCountdownModal, setShowCountdownModal] = useState(false)
  const datesSet = useMemo(() => new Set(datesWithData), [datesWithData])

  const handleDayClick = (date) => {
    setSelectedDate(date)
    navigate('/today')
  }

  const getDayStatus = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return {
      today: isToday(date),
      selected: isSameDay(date, selectedDate),
      hasData: datesSet.has(dateStr),
      countdowns: countdowns.filter(cd => cd.date === dateStr)
    }
  }

  const title = headerTitle(view, cursor)
  const View = VIEW_COMPONENTS[view]

  return (
    <div className="calendar-page">
      <div className="page-header">
        <span className="page-title">日历</span>
        <div className="tabs" style={{ width: 'auto' }} ref={tabsThumbRef}>
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

      <div className="cal-nav">
        <button className="cal-nav-arrow" onClick={() => step(-1)} aria-label="上一页">‹</button>
        <button className="cal-today-btn btn btn-primary btn-sm" onClick={goToToday}>
          今日
        </button>
        <span key={title} className={`cal-header-title cal-title-${motion}`}>{title}</span>
        <button className="cal-nav-arrow" onClick={() => step(1)} aria-label="下一页">›</button>
      </div>

      <div className="cal-content">
        {/* A new key per view and period replays the arrival: the page slides in from the side it
         * moved from, and its cells follow one after another (each cell fades itself). */}
        <div key={`${view}:${periodKey(view, cursor)}`} className={`cal-slide cal-slide-${motion}`}>
          <View cursor={cursor} getDayStatus={getDayStatus} onDayClick={handleDayClick} />
        </div>
      </div>

      {countdowns.length > 0 && <CountdownLegend countdowns={countdowns} />}

      <Presence>{showCountdownModal && (
        <CountdownModal
          countdowns={countdowns}
          onSave={saveCountdowns}
          onClose={() => setShowCountdownModal(false)}
          confirm={confirm}
        />
      )}</Presence>
    </div>
  )
}
