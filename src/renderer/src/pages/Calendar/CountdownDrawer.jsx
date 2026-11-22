import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  addCountdown,
  describeRepeat,
  groupCountdowns,
  keyCountdowns,
  removeCountdown,
  updateCountdown
} from '../../utils/countdowns'
import CountdownFields from './CountdownFields'
import {
  draftFromCountdown,
  emptyDraft,
  fieldsOfDraft,
  patchForChange,
  suggestColor,
  validateDraft
} from './countdownDraft'
import './CountdownDrawer.css'

const ENDED_COLLAPSE_ABOVE = 3

function describeMeta(countdown, status) {
  if (!status.valid) return '日期无法识别，点开后重新选择'
  const parts = [`${status.date.replace(/-/g, '/')} ${format(status.day, 'EEE', { locale: zhCN })}`]
  if (status.milestone) parts.push(status.milestone)
  if (countdown.note) parts.push(countdown.note)
  return parts.join(' · ')
}

function DaysBadge({ status }) {
  if (!status.valid) return <span className="cd-days is-unknown">—</span>
  if (status.days === 0) return <span className="cd-days is-today" title={status.text}><b>今天</b></span>
  const past = status.days < 0
  return (
    <span className={`cd-days ${past ? 'is-past' : ''}`} title={status.text}>
      <em>{past ? '已过' : '还有'}</em>
      <span className="cd-days-count"><b>{Math.abs(status.days)}</b><small>天</small></span>
    </span>
  )
}

// The layout the list had when an editor was opened, so that rows do not jump around while their
// date is being typed. Whatever is new since goes to the group it belongs to now.
function applyFrozenLayout(live, frozen) {
  if (!frozen) return live
  const all = new Map([...live.upcoming, ...live.ended, ...live.unreadable].map(entry => [entry.countdown.key, entry]))
  const take = (keys) => keys.filter(key => all.has(key)).map(key => {
    const entry = all.get(key)
    all.delete(key)
    return entry
  })
  const upcoming = take(frozen.upcoming)
  const ended = take(frozen.ended)
  const unreadable = take(frozen.unreadable)
  for (const entry of all.values()) {
    if (!entry.status.valid) unreadable.push(entry)
    else if (entry.status.ended) ended.push(entry)
    else upcoming.push(entry)
  }
  return { upcoming, ended, unreadable }
}

const keysOf = (entries) => entries.map(entry => entry.countdown.key)

// One countdown being edited: every valid change is stored at once, so there is nothing to confirm.
function CountdownEditor({ countdown, onPatch, onDelete }) {
  const [draft, setDraft] = useState(() => draftFromCountdown(countdown))
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const deleteRef = useRef(null)
  const confirmRef = useRef(null)
  const problems = validateDraft(draft)

  const change = (patch) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    const stored = patchForChange(next, Object.keys(patch))
    if (Object.keys(stored).length > 0) {
      onPatch(stored)
      setSaved(true)
    }
  }

  // Leaving a field that is still wrong puts back what is stored; a good name is tidied.
  const settle = (field) => {
    const stored = draftFromCountdown(countdown)
    if (field === 'name') setDraft(current => ({ ...current, name: problems.name ? stored.name : current.name.trim() }))
    else if (field === 'date' && problems.date) setDraft(current => ({ ...current, date: stored.date }))
    else if (field === 'every' && problems.every) setDraft(current => ({ ...current, every: stored.every }))
  }

  useEffect(() => {
    if (!confirming) return undefined
    confirmRef.current?.focus({ preventScroll: true })
    const timer = setTimeout(() => setConfirming(false), 6000)
    return () => clearTimeout(timer)
  }, [confirming])

  const cancelDelete = () => {
    setConfirming(false)
    requestAnimationFrame(() => deleteRef.current?.focus({ preventScroll: true }))
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !confirming || event.isComposing) return
    event.preventDefault()
    event.stopPropagation()
    cancelDelete()
  }

  return (
    <div className="cd-edit" onKeyDown={onKeyDown}>
      <CountdownFields draft={draft} problems={problems} onChange={change} onFieldBlur={settle} noteRows={2} />
      <div className="cd-edit-foot">
        <span className={`cd-saved ${saved ? 'is-saved' : ''}`} aria-live="polite">
          {saved ? '✓ 修改已自动保存' : '修改会自动保存'}
        </span>
        {confirming ? (
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={cancelDelete}>取消</button>
            <button type="button" className="btn btn-sm btn-danger" ref={confirmRef} onClick={onDelete}>确认删除</button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-ghost cd-delete" ref={deleteRef} onClick={() => setConfirming(true)}>删除</button>
        )}
      </div>
    </div>
  )
}

// The form for a new countdown: one "添加" and it is stored.
function NewCountdownForm({ initial, onAdd, onCancel, focusName }) {
  const formRef = useRef(null)
  const [draft, setDraft] = useState(initial)
  const [tried, setTried] = useState(false)
  const problems = validateDraft(draft)
  const wrong = Boolean(problems.name || problems.date || problems.every)

  const submit = (event) => {
    event.preventDefault()
    setTried(true)
    if (wrong) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus({ preventScroll: true }))
      return
    }
    onAdd(fieldsOfDraft(draft))
  }

  return (
    <form ref={formRef} className="cd-new is-open" onSubmit={submit} noValidate aria-label="新建倒数日">
      <div className="cd-new-title">新建倒数日</div>
      <CountdownFields
        draft={draft}
        problems={tried ? problems : {}}
        onChange={patch => setDraft(current => ({ ...current, ...patch }))}
        focusName={focusName}
      />
      <div className="cd-new-foot">
        <span className="cd-hint">填好名称和日期，点「添加」即保存</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>取消</button>
        <button type="submit" className="btn btn-primary btn-sm">添加</button>
      </div>
    </form>
  )
}

/**
 * The countdown days beside the calendar. Nothing here waits for a "save": a new countdown is stored
 * when it is added, and a change to an existing one is stored as soon as the field is valid.
 *
 *   countdowns       the stored list as readCountdowns reads it
 *   saveCountdowns   the app's writer (takes the new list, or a function of the stored one)
 *   today            the start of today
 *   intent           what to open: { type: 'new', date? } or { type: 'edit', key }, with a `nonce`
 *                    that changes each time the same thing is asked for again
 *   onClose          close the drawer
 */
export default function CountdownDrawer({ countdowns, saveCountdowns, today, intent, onClose }) {
  const rootRef = useRef(null)
  const [openKey, setOpenKey] = useState(null)
  const [frozen, setFrozen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [formSeed, setFormSeed] = useState(0)
  const [newInitial, setNewInitial] = useState(() => emptyDraft())
  const [showEnded, setShowEnded] = useState(null)
  const [flashKey, setFlashKey] = useState(null)

  const live = useMemo(() => groupCountdowns(countdowns, today), [countdowns, today])
  const groups = useMemo(() => applyFrozenLayout(live, frozen), [live, frozen])
  const endedOpen = showEnded ?? groups.ended.length <= ENDED_COLLAPSE_ABOVE
  const latest = useRef({})
  latest.current = { countdowns, live, groups }

  // Focus moves in when the drawer opens and back to where it came from when it closes.
  useEffect(() => {
    const root = rootRef.current
    const opener = document.activeElement
    ;(root.querySelector('[data-autofocus]') || root).focus({ preventScroll: true })
    return () => {
      const active = document.activeElement
      if (opener instanceof HTMLElement && opener.isConnected && (!active || active === document.body || root.contains(active))) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])

  const focusLater = (selector) => requestAnimationFrame(() => rootRef.current?.querySelector(selector)?.focus({ preventScroll: true }))
  const scrollTo = (key) => requestAnimationFrame(() => {
    rootRef.current?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' })
  })

  const openEditor = (key) => {
    const { live: now } = latest.current
    setAdding(false)
    setFrozen({ upcoming: keysOf(now.upcoming), ended: keysOf(now.ended), unreadable: keysOf(now.unreadable) })
    if (now.ended.some(entry => entry.countdown.key === key)) setShowEnded(true)
    setOpenKey(key)
    scrollTo(key)
  }
  const closeEditor = () => {
    setOpenKey(null)
    setFrozen(null)
  }
  const startAdding = (date = '') => {
    closeEditor()
    setNewInitial(emptyDraft({ date, color: suggestColor(latest.current.countdowns) }))
    setFormSeed(seed => seed + 1)
    setAdding(true)
  }

  // Asked from outside (a right-click on a day, a chip under the calendar).
  useEffect(() => {
    if (!intent) return
    if (intent.type === 'edit') openEditor(intent.key)
    else startAdding(intent.date ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new request counts
  }, [intent?.nonce])

  // A first countdown needs no click to start: the form is already there.
  useEffect(() => {
    if (countdowns.length === 0 && !intent) startAdding()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the drawer opens
  }, [])

  // The one just added is shown, and flashes so it is clear it is in.
  useEffect(() => {
    if (!flashKey) return undefined
    scrollTo(flashKey)
    const timer = setTimeout(() => setFlashKey(null), 1800)
    return () => clearTimeout(timer)
  }, [flashKey])

  const patch = (key, changes) => saveCountdowns(list => updateCountdown(list, key, changes))

  const add = (fields) => {
    let addedKey = null
    saveCountdowns(list => {
      const next = addCountdown(list, fields)
      addedKey = keyCountdowns(next).at(-1)
      return next
    })
    setAdding(false)
    setFlashKey(addedKey)
    focusLater(`[data-key="${CSS.escape(addedKey)}"] .cd-row`)
  }

  const remove = (key) => {
    saveCountdowns(list => removeCountdown(list, key))
    closeEditor()
    focusLater('[data-cd-new]')
  }

  // Esc backs out one step at a time: the form or editor first, then the drawer.
  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    event.stopPropagation()
    if (adding && countdowns.length > 0) {
      setAdding(false)
      focusLater('[data-cd-new]')
    } else if (openKey) {
      const key = openKey
      closeEditor()
      focusLater(`[data-key="${CSS.escape(key)}"] .cd-row`)
    } else {
      onClose()
    }
  }

  const renderEntry = ({ countdown, status }) => {
    const open = openKey === countdown.key
    return (
      <div
        key={countdown.key}
        data-key={countdown.key}
        className={`cd-item ${open ? 'is-open' : ''} ${status.ended ? 'is-ended' : ''} ${flashKey === countdown.key ? 'is-new' : ''}`}
      >
        <button
          type="button"
          className="cd-row"
          aria-expanded={open}
          onClick={() => (open ? closeEditor() : openEditor(countdown.key))}
        >
          <span className="cd-dot" style={{ background: countdown.color || 'var(--accent)' }} />
          <span className="cd-row-main">
            <span className="cd-row-name">
              <span className="cd-row-title">{countdown.name || '（未命名）'}</span>
              {countdown.repeat && <span className="cd-rep">↻ {describeRepeat(countdown.repeat)}</span>}
            </span>
            <span className="cd-row-meta">{describeMeta(countdown, status)}</span>
          </span>
          <DaysBadge status={status} />
        </button>
        {open && (
          <CountdownEditor
            countdown={countdown}
            onPatch={changes => patch(countdown.key, changes)}
            onDelete={() => remove(countdown.key)}
          />
        )}
      </div>
    )
  }

  return (
    <aside ref={rootRef} className="cd-drawer" aria-label="倒数日" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="cd-drawer-head">
        <h2>倒数日</h2>
        <span className="cd-drawer-sub">{countdowns.length} 个 · 修改即时保存</span>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="关闭倒数日" onClick={onClose}>✕</button>
      </div>

      <div className="cd-drawer-body">
        {adding ? (
          <NewCountdownForm
            key={formSeed}
            initial={newInitial}
            focusName
            onAdd={add}
            onCancel={() => {
              setAdding(false)
              focusLater('[data-cd-new]')
            }}
          />
        ) : (
          <button type="button" className="cd-new" data-cd-new onClick={() => startAdding()}>＋ 新建倒数日</button>
        )}

        {countdowns.length === 0 && (
          <p className="cd-empty">还没有倒数日。记下生日、考试、出发日……每个都能设为每周、每月或每年重复。</p>
        )}

        {groups.upcoming.length > 0 && (
          <section aria-label="即将到来">
            <div className="cd-group">即将到来 · {groups.upcoming.length}</div>
            {groups.upcoming.map(renderEntry)}
          </section>
        )}

        {groups.unreadable.length > 0 && (
          <section aria-label="日期无法识别">
            <div className="cd-group">日期无法识别 · {groups.unreadable.length}</div>
            {groups.unreadable.map(renderEntry)}
          </section>
        )}

        {groups.ended.length > 0 && (
          <section aria-label="已结束">
            <button type="button" className="cd-group cd-group-toggle" aria-expanded={endedOpen} onClick={() => setShowEnded(!endedOpen)}>
              <span className="cd-group-caret" aria-hidden="true">{endedOpen ? '▾' : '▸'}</span>
              已结束 · {groups.ended.length}
            </button>
            {endedOpen && groups.ended.map(renderEntry)}
          </section>
        )}
      </div>
    </aside>
  )
}
