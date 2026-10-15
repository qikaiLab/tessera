import { useState } from 'react'
import { addDays, format, isToday, isValid, parseISO, subDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import SaveStatusBadge from '../../components/SaveStatusBadge'

function formatDateDisplay(date) {
  if (isToday(date)) return '今日'
  return format(date, 'MM月dd日 EEEE', { locale: zhCN })
}

// Day navigation (arrows, the date with its jump picker, "back to today") on the left; the notes
// drawer toggle and the save status on the right.
export default function TodayHeader({
  selectedDate,
  dateStr,
  dateTransitionDir,
  returnTodayPhase,
  onGo,
  onReturnToToday,
  notesDrawerOpen,
  onToggleNotesDrawer,
  saveStatus
}) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [jumpInput, setJumpInput] = useState('')

  const handleJump = (event) => {
    event.preventDefault()
    const parsed = parseISO(jumpInput)
    if (isValid(parsed)) {
      onGo(parsed)
      setShowDatePicker(false)
      setJumpInput('')
    }
  }

  return (
    <div className="today-header">
      <div className="today-nav">
        <button className="btn btn-ghost btn-icon" onClick={() => onGo(subDays(selectedDate, 1))} title="前一天">
          ←
        </button>
        <div className="today-date-group">
          <div className="today-date" onClick={() => setShowDatePicker(v => !v)}>
            <div key={dateStr} className={`today-date-motion date-motion-${dateTransitionDir}`}>
              <span className="today-date-main">{formatDateDisplay(selectedDate)}</span>
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
          onClick={() => onGo(addDays(selectedDate, 1))}
          title="后一天"
        >
          →
        </button>
        <div className="today-return-slot">
          {returnTodayPhase !== 'hidden' && (
            <button
              className={`btn btn-primary btn-sm today-return-button is-${returnTodayPhase}`}
              onClick={onReturnToToday}
              aria-disabled={returnTodayPhase === 'leaving'}
            >
              ✦ 回到今日
            </button>
          )}
        </div>
      </div>
      <div className="today-header-right">
        <button
          className={`today-notes-toggle ${notesDrawerOpen ? 'active' : ''}`}
          onClick={onToggleNotesDrawer}
          title={notesDrawerOpen ? '收起便签抽屉' : '打开便签抽屉'}
          aria-label={notesDrawerOpen ? '收起便签抽屉' : '打开便签抽屉'}
        >
          <span className="today-notes-toggle-mark">{notesDrawerOpen ? '›' : '‹'}</span>
        </button>
        <SaveStatusBadge status={saveStatus} />
      </div>
    </div>
  )
}
