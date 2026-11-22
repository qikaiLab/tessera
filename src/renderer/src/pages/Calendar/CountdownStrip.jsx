import { useMemo } from 'react'
import { groupCountdowns } from '../../utils/countdowns'

const SHOWN = 3

/**
 * Under the calendar: the nearest countdowns still ahead, as chips that open the drawer on that
 * countdown, and a way into the drawer for the rest. Nothing when there are no countdowns.
 */
export default function CountdownStrip({ countdowns, today, onOpen, onManage }) {
  const { upcoming } = useMemo(() => groupCountdowns(countdowns, today), [countdowns, today])
  if (countdowns.length === 0) return null
  const chips = upcoming.slice(0, SHOWN)
  const more = upcoming.length - chips.length

  return (
    <div className="cd-strip" role="region" aria-label="最近的倒数日">
      <span className="cd-strip-label">最近</span>
      {chips.length === 0 && <span className="cd-strip-none">没有即将到来的倒数日</span>}
      {chips.map(({ countdown, status }) => (
        <button
          key={countdown.key}
          type="button"
          className={`cd-chip ${status.days === 0 ? 'is-today' : ''}`}
          title={[countdown.name, status.text, status.milestone].filter(Boolean).join(' · ')}
          onClick={() => onOpen(countdown.key)}
        >
          <i style={{ background: countdown.color || 'var(--accent)' }} />
          <span className="cd-chip-name">{countdown.name || '（未命名）'}</span>
          <span className="cd-chip-days">{status.days === 0 ? '今天' : status.text}</span>
        </button>
      ))}
      {more > 0 && <span className="cd-more">+{more}</span>}
      <span className="cd-strip-grow" />
      <button type="button" className="btn btn-ghost btn-sm" onClick={onManage}>管理倒数日</button>
    </div>
  )
}
