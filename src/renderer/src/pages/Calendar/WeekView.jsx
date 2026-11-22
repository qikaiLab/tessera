import { eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { WEEKDAYS, cellDelay, countdownColor, countdownLabel } from './calendarViews'

export default function WeekView({ cursor, getDayStatus, onDayClick, onDayContextMenu }) {
  const start = startOfWeek(cursor, { weekStartsOn: 1 })
  const end = endOfWeek(cursor, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })

  return (
    <div className="week-view">
      <div className="cal-grid week-grid">
        {days.map((day, i) => {
          const { today, selected, hasData, countdowns } = getDayStatus(day)
          return (
            <button
              key={i}
              className={`cal-day week-day ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}`}
              style={cellDelay(0, i * 2)}
              onClick={() => onDayClick(day)}
              onContextMenu={event => onDayContextMenu(day, event)}
            >
              <span className="cal-weekday-label">{WEEKDAYS[i]}</span>
              <span className="cal-day-num large">{format(day, 'd')}</span>
              <span className="cal-month-label">{format(day, 'MM月', { locale: zhCN })}</span>
              {today && <span className="cal-today-pill">今天</span>}
              {hasData && <span className="cal-dot" />}
              {countdowns.length > 0 && (
                <span className="week-tags">
                  {countdowns.map((countdown, index) => (
                    <span key={countdown.key} className="cal-countdown-tag" style={{ background: countdownColor(countdown), '--k': index }} title={countdownLabel(countdown)}>
                      {countdownLabel(countdown)}
                    </span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
