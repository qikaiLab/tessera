import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { WEEKDAYS, cellDelay } from './calendarViews'

export default function MonthView({ cursor, getDayStatus, onDayClick }) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })

  return (
    <div className="month-view">
      <div className="cal-weekdays">
        {WEEKDAYS.map(d => <span key={d} className="cal-weekday">{d}</span>)}
      </div>
      <div className="cal-grid month-grid">
        {days.map((day, i) => {
          const { today, selected, hasData, countdowns } = getDayStatus(day)
          return (
            <button
              key={i}
              className={`cal-day ${isSameMonth(day, cursor) ? '' : 'other-month'} ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}`}
              style={cellDelay(Math.floor(i / 7), i % 7)}
              onClick={() => onDayClick(day)}
            >
              <span className="cal-day-num">{format(day, 'd')}</span>
              {hasData && <span className="cal-dot" />}
              {countdowns.length > 0 && (
                <span
                  className="cal-countdown-tag cal-countdown-tag--mini"
                  style={{ background: countdowns[0].color || 'var(--accent)' }}
                  title={countdowns.map(c => c.name).join(', ')}
                >
                  {countdowns[0].name.length > 4 ? countdowns[0].name.slice(0, 3) + '…' : countdowns[0].name}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
