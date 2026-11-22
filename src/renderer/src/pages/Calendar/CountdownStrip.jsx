import { useMemo } from 'react'
import { groupCountdowns } from '../../utils/countdowns'

const SHOWN = 3

/**
 * Under the calendar: the nearest countdowns still ahead, as chips that open the drawer on that
 * countdown, and the way into the drawer (the only one: there is none in the page header). With no
 * countdowns it says so and offers to add one.
 *
 * It is always there. While the drawer is open (`hidden`) it folds away and, once folded, cannot be
 * reached; it does not use `inert` or `aria-hidden`, so the button that opened the drawer keeps its
 * focus until the drawer takes it, and gets it back when the drawer is closed.
 */
export default function CountdownStrip({ countdowns, today, hidden, onOpen, onManage }) {
  const { upcoming } = useMemo(() => groupCountdowns(countdowns, today), [countdowns, today])
  const empty = countdowns.length === 0
  const chips = upcoming.slice(0, SHOWN)
  const more = upcoming.length - chips.length

  return (
    <div className={`cd-strip-wrap ${hidden ? 'is-hidden' : ''}`}>
      <div className="cd-strip" role="region" aria-label="最近的倒数日">
        {empty ? (
          <span className="cd-strip-none">还没有倒数日</span>
        ) : (
          <>
            <span className="cd-strip-label">最近</span>
            {chips.length === 0 && <span className="cd-strip-none">没有即将到来的倒数日</span>}
            {chips.map(({ countdown, status }, index) => (
              <button
                key={countdown.key}
                type="button"
                className={`cd-chip ${status.days === 0 ? 'is-today' : ''}`}
                style={{ '--cd-i': index }}
                title={[countdown.name, status.text, status.milestone].filter(Boolean).join(' · ')}
                onClick={() => onOpen(countdown.key)}
              >
                <i style={{ background: countdown.color || 'var(--accent)' }} />
                <span className="cd-chip-name">{countdown.name || '（未命名）'}</span>
                <span className="cd-chip-days">{status.days === 0 ? '今天' : status.text}</span>
              </button>
            ))}
            {more > 0 && <span className="cd-more">+{more}</span>}
          </>
        )}
        <span className="cd-strip-grow" />
        <button type="button" className="btn btn-ghost btn-sm cd-strip-manage" onClick={onManage}>
          {empty ? '添加倒数日' : '管理倒数日'}
        </button>
      </div>
    </div>
  )
}
