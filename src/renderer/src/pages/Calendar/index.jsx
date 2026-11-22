import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { endOfWeek, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import Presence from '../../components/Presence'
import { countdownsOn, readCountdowns } from '../../utils/countdowns'
import { separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'
import { useSlidingThumb } from '../../utils/useSlidingThumb'
import CountdownDrawer from './CountdownDrawer'
import CountdownStrip from './CountdownStrip'
import MonthView from './MonthView'
import WeekView from './WeekView'
import YearView from './YearView'
import { countdownLabel, periodKey } from './calendarViews'
import { useCalendarNavigation } from './useCalendarNavigation'
import { useToday } from './useToday'
import './Calendar.css'

const VIEWS = ['month', 'week', 'year']
const VIEW_LABELS = { month: '月', week: '周', year: '年' }
const VIEW_COMPONENTS = { month: MonthView, week: WeekView, year: YearView }
const EDIT_PREFIX = 'edit-countdown:'
const MENU_NAME_LIMIT = 12
const MENU_COUNTDOWN_LIMIT = 5

function headerTitle(view, cursor) {
  if (view === 'month') return format(cursor, 'yyyy年MM月', { locale: zhCN })
  if (view === 'week') {
    const start = startOfWeek(cursor, { weekStartsOn: 1 })
    const end = endOfWeek(cursor, { weekStartsOn: 1 })
    return `${format(start, 'MM月dd日')} — ${format(end, 'MM月dd日')}`
  }
  return format(cursor, 'yyyy年', { locale: zhCN })
}

const shortName = (countdown) => {
  const name = countdownLabel(countdown)
  return name.length > MENU_NAME_LIMIT ? `${name.slice(0, MENU_NAME_LIMIT - 1)}…` : name
}

// The calendar: month, week and year views showing which days have records and which carry a
// countdown; clicking a day opens it on the record page. The countdown days are managed in a
// drawer beside the calendar.
export default function Calendar() {
  const tabsThumbRef = useSlidingThumb()
  const navigate = useNavigate()
  const { datesWithData, selectedDate, setSelectedDate, countdowns: storedCountdowns, saveCountdowns } = useApp()
  const { view, setView, cursor, motion, goToToday, step } = useCalendarNavigation()
  const today = useToday()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [intent, setIntent] = useState(null)
  const intentCount = useRef(0)
  const datesSet = useMemo(() => new Set(datesWithData), [datesWithData])
  const countdowns = useMemo(() => readCountdowns(storedCountdowns), [storedCountdowns])

  const openDrawer = useCallback((request = null) => {
    // The nonce makes asking for the same thing twice count as asking again.
    setIntent(request && { ...request, nonce: ++intentCount.current })
    setDrawerOpen(true)
  }, [])

  const handleDayClick = useCallback((date) => {
    setSelectedDate(date)
    navigate('/today')
  }, [navigate, setSelectedDate])

  useContextMenuCommand('calendar-day', useCallback((id, context) => {
    if (id === 'open-day') handleDayClick(parseISO(context.date))
    else if (id === 'add-countdown') openDrawer({ type: 'new', date: context.date })
    else if (id.startsWith(EDIT_PREFIX)) openDrawer({ type: 'edit', key: id.slice(EDIT_PREFIX.length) })
  }, [handleDayClick, openDrawer]))

  const handleDayContextMenu = (date, event) => {
    const here = countdownsOn(countdowns, date).slice(0, MENU_COUNTDOWN_LIMIT)
    showContextMenu(event, [
      { id: 'open-day', label: '打开这一天的记录' },
      { id: 'add-countdown', label: '在这一天添加倒数日' },
      ...(here.length > 0 ? [separator] : []),
      ...here.map(countdown => ({ id: `${EDIT_PREFIX}${countdown.key}`, label: `编辑倒数日「${shortName(countdown)}」` }))
    ], { scope: 'calendar-day', date: format(date, 'yyyy-MM-dd') })
  }

  const getDayStatus = (date) => ({
    today: isSameDay(date, today),
    selected: isSameDay(date, selectedDate),
    hasData: datesSet.has(format(date, 'yyyy-MM-dd')),
    countdowns: countdownsOn(countdowns, date)
  })

  const title = headerTitle(view, cursor)
  const View = VIEW_COMPONENTS[view]

  return (
    <div className={`calendar-page ${drawerOpen ? 'with-drawer' : ''}`}>
      <div className="cal-main">
        <div className="page-header">
          <span className="page-title">日历</span>
          <div className="tabs" style={{ width: 'auto' }} ref={tabsThumbRef}>
            {VIEWS.map(v => (
              <button key={v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {VIEW_LABELS[v]}视图
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm cd-entry"
            aria-expanded={drawerOpen}
            onClick={() => (drawerOpen ? setDrawerOpen(false) : openDrawer())}
          >
            <span aria-hidden="true">⏱</span> 倒数日
            {countdowns.length > 0 && <span className="cd-count">{countdowns.length}</span>}
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
            <View cursor={cursor} getDayStatus={getDayStatus} onDayClick={handleDayClick} onDayContextMenu={handleDayContextMenu} />
          </div>
        </div>

        {!drawerOpen && (
          <CountdownStrip
            countdowns={countdowns}
            today={today}
            onOpen={key => openDrawer({ type: 'edit', key })}
            onManage={() => openDrawer()}
          />
        )}
      </div>

      <Presence>{drawerOpen && (
        <CountdownDrawer
          countdowns={countdowns}
          saveCountdowns={saveCountdowns}
          today={today}
          intent={intent}
          onClose={() => setDrawerOpen(false)}
        />
      )}</Presence>
    </div>
  )
}
