import {
  eachDayOfInterval, eachMonthOfInterval, endOfMonth, endOfWeek, endOfYear, format,
  isSameMonth, startOfMonth, startOfWeek, startOfYear
} from 'date-fns'
import { WEEKDAYS, cellDelay } from './calendarViews'

export default function YearView({ cursor, getDayStatus, onDayClick }) {
  const months = eachMonthOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) })

  return (
    <div className="year-view">
      {months.map((month, monthIndex) => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
        const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
        const days = eachDayOfInterval({ start, end })

        return (
          <div key={month.toISOString()} className="year-month" style={cellDelay(Math.floor(monthIndex / 4), monthIndex % 4 * 2)}>
            <div className="year-month-title">{format(month, 'MM月')}</div>
            <div className="year-grid">
              {WEEKDAYS.map(d => <span key={d} className="year-weekday">{d}</span>)}
              {days.map((day, i) => {
                const { today, selected, hasData, countdowns } = getDayStatus(day)
                const hasCountdown = countdowns.length > 0
                return (
                  <button
                    key={i}
                    className={`year-day ${isSameMonth(day, month) ? '' : 'other-month'} ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${hasData ? 'has-data' : ''} ${hasCountdown ? 'has-countdown' : ''}`}
                    onClick={() => onDayClick(day)}
                    title={hasCountdown ? countdowns.map(c => `⏱ ${c.name}`).join('\n') : undefined}
                    style={hasCountdown ? { '--cd-color': countdowns[0].color || 'var(--accent)' } : {}}
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
