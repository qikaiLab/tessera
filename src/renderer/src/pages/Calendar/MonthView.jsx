import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { WEEKDAYS, cellDelay, countdownColor, countdownLabel } from './calendarViews'

const MAX_BARS = 3

// A day with one countdown carries its name; with several, one short bar of each colour (the title
// lists them all), so a busy day stays readable inside a small cell.
function CountdownMarkers({ countdowns }) {
  if (countdowns.length === 0) return null
  const title = countdowns.map(countdown => `⏱ ${countdownLabel(countdown)}`).join('\n')
  if (countdowns.length === 1) {
    return (
      <span className="cal-countdown-tag cal-countdown-tag--mini" style={{ background: countdownColor(countdowns[0]) }} title={title}>
        {countdownLabel(countdowns[0])}
      </span>
    )
  }
  return (
    <span className="cal-bars" title={title}>
      {countdowns.slice(0, MAX_BARS).map(countdown => <i key={countdown.key} style={{ background: countdownColor(countdown) }} />)}
    </span>
  )
}

export default function MonthView({ cursor, getDayStatus, onDayClick, onDayContextMenu }) {
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
              onContextMenu={event => onDayContextMenu(day, event)}
            >
              <span className="cal-day-num">{format(day, 'd')}</span>
              {hasData && <span className="cal-dot" />}
              <CountdownMarkers countdowns={countdowns} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
