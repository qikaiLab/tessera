import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import Unfold from '../../components/Unfold'
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
const SECTIONS = ['upcoming', 'unreadable', 'ended']
// How long the things that come and go take, in ms. A row folds away in REMOVE_MS and the first
// rows arrive within ENTERING_MS: those two are the same figures as in the stylesheet.
const EDITOR_MS = 280
const FORM_MS = 280
const REMOVE_MS = 300
const ENTERING_MS = 800
const REORDER_MS = 340

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

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

// Countdowns that were just deleted stay where they were, folding shut, until their exit is over.
// One whose key a live countdown has taken over (keys of a list without ids follow the position) is
// not kept: that would be two rows with one key.
function withLeaving(groups, leaving) {
  if (leaving.length === 0) return groups
  const live = new Set(SECTIONS.flatMap(section => groups[section].map(entry => entry.countdown.key)))
  const merged = { upcoming: [...groups.upcoming], ended: [...groups.ended], unreadable: [...groups.unreadable] }
  for (const gone of [...leaving].sort((a, b) => a.index - b.index)) {
    if (live.has(gone.key)) continue
    const list = merged[gone.section]
    list.splice(Math.min(gone.index, list.length), 0, { ...gone.entry, removing: true })
  }
  return merged
}

const keysOf = (entries) => entries.map(entry => entry.countdown.key)
const rowSelector = (key) => `[data-key="${CSS.escape(key)}"]`

// One countdown being edited: every valid change is stored at once, so there is nothing to confirm.
function CountdownEditor({ countdown, onPatch, onDelete }) {
  const [draft, setDraft] = useState(() => draftFromCountdown(countdown))
  const [saves, setSaves] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const deleteRef = useRef(null)
  const confirmRef = useRef(null)
  const refocusDelete = useRef(false)
  const problems = validateDraft(draft)

  const change = (patch) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    const stored = patchForChange(next, Object.keys(patch))
    if (Object.keys(stored).length > 0) {
      onPatch(stored)
      setSaves(count => count + 1)
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
    if (!confirming) {
      if (refocusDelete.current) deleteRef.current?.focus({ preventScroll: true })
      refocusDelete.current = false
      return undefined
    }
    confirmRef.current?.focus({ preventScroll: true })
    const timer = setTimeout(() => setConfirming(false), 6000)
    return () => clearTimeout(timer)
  }, [confirming])

  const cancelDelete = () => {
    refocusDelete.current = true
    setConfirming(false)
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
        {/* The tick is a new element for every save, so each one pulses (it is hidden from readers:
         * the sentence says it, and a live region should not repeat it for every keystroke). */}
        <span className={`cd-saved ${saves > 0 ? 'is-saved' : ''}`} aria-live="polite">
          {saves > 0 ? <><span className="cd-tick" key={saves} aria-hidden="true">✓</span> 修改已自动保存</> : '修改会自动保存'}
        </span>
        {confirming ? (
          <>
            <button type="button" className="btn btn-sm btn-ghost cd-swap-in" onClick={cancelDelete}>取消</button>
            <button type="button" className="btn btn-sm btn-danger cd-swap-in" ref={confirmRef} onClick={onDelete}>确认删除</button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-ghost cd-delete cd-swap-in" ref={deleteRef} onClick={() => setConfirming(true)}>删除</button>
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
  const [rejected, setRejected] = useState(0)
  const problems = validateDraft(draft)
  const wrong = Boolean(problems.name || problems.date || problems.every)

  // A refused "添加" goes to the first wrong field and shakes the form a little (the shake is a
  // transform, so the glass of the form is untouched).
  useEffect(() => {
    if (rejected === 0) return
    const form = formRef.current
    form?.querySelector('[aria-invalid="true"]')?.focus({ preventScroll: true })
    if (form?.animate && !prefersReducedMotion()) {
      form.animate(
        [{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }],
        { duration: 340, easing: 'ease-out' }
      )
    }
  }, [rejected])

  const submit = (event) => {
    event.preventDefault()
    setTried(true)
    if (wrong) {
      setRejected(count => count + 1)
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
 * Esc steps back one layer (the form or the open editor first, then the drawer) and focus returns
 * to the button that opened it: the entry in the strip under the calendar (the page header has
 * none). What comes and goes uses components/Unfold.jsx (a direct height animation; a grid row
 * 0fr <-> 1fr would leave a gap midway). A deleted row folds away where it stands, on timers
 * rather than `animationend`. Anything holding glass only moves or changes height;
 * tests/e2e/frosted-glass-motion.spec.mjs checks every frame.
 *
 *   countdowns      the stored list as readCountdowns reads it
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
  const [entering, setEntering] = useState(true)
  const [leaving, setLeaving] = useState([])

  const live = useMemo(() => groupCountdowns(countdowns, today), [countdowns, today])
  const groups = useMemo(() => applyFrozenLayout(live, frozen), [live, frozen])
  const shown = useMemo(() => withLeaving(groups, leaving), [groups, leaving])
  const endedOpen = showEnded ?? groups.ended.length <= ENDED_COLLAPSE_ABOVE
  const latest = useRef({})
  latest.current = { countdowns, live, groups }

  // For its first moments the drawer lets the rows arrive one after another.
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), ENTERING_MS)
    return () => clearTimeout(timer)
  }, [])

  // Rows that change places (a date edited, then the editor closed) glide there instead of
  // jumping: where each was is noted when the change is asked for, and after the render each is
  // moved back and let go. Layout animations (an editor opening, a row folding away) are not part
  // of this: nothing is noted for them, so the rows below simply follow.
  const rowTops = useRef(null)
  const noteRows = () => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    rowTops.current = new Map([...root.querySelectorAll('.cd-item[data-key]')].map(row => [row.dataset.key, row.getBoundingClientRect().top]))
  }
  useLayoutEffect(() => {
    const before = rowTops.current
    if (!before) return
    rowTops.current = null
    for (const row of rootRef.current?.querySelectorAll('.cd-item[data-key]') ?? []) {
      const from = before.get(row.dataset.key)
      if (from === undefined) continue
      const distance = from - row.getBoundingClientRect().top
      if (Math.abs(distance) < 2) continue
      row.animate?.([{ transform: `translateY(${distance}px)` }, { transform: 'none' }], { duration: REORDER_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    }
  })

  const leavingTimers = useRef(new Set())
  useEffect(() => {
    const timers = leavingTimers.current
    return () => timers.forEach(clearTimeout)
  }, [])

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

  // Moving focus or scrolling waits for the render that draws the target (not for an animation frame,
  // which a window in the background never runs): it is noted here and done after the next commit.
  const pending = useRef({ focus: null, scroll: null })
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const { focus, scroll } = pending.current
    const toScroll = scroll && root.querySelector(scroll)
    if (toScroll) {
      pending.current.scroll = null
      toScroll.scrollIntoView({ block: 'nearest' })
    }
    const toFocus = focus && root.querySelector(focus)
    if (toFocus) {
      pending.current.focus = null
      toFocus.focus({ preventScroll: true })
    }
  })
  const focusLater = (selector) => { pending.current.focus = selector }
  const scrollTo = (key) => { pending.current.scroll = rowSelector(key) }

  const openEditor = (key) => {
    const { live: now } = latest.current
    noteRows()
    setAdding(false)
    setFrozen({ upcoming: keysOf(now.upcoming), ended: keysOf(now.ended), unreadable: keysOf(now.unreadable) })
    if (now.ended.some(entry => entry.countdown.key === key)) setShowEnded(true)
    setOpenKey(key)
    scrollTo(key)
  }
  const closeEditor = () => {
    noteRows()
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
    scrollTo(addedKey)
    focusLater(`${rowSelector(addedKey)} .cd-row`)
  }

  // The data goes at once; the row stays a moment longer, folding away, so the list closes up
  // smoothly instead of jumping.
  const remove = (key) => {
    const { groups: now } = latest.current
    const section = SECTIONS.find(name => now[name].some(entry => entry.countdown.key === key))
    if (section) {
      const index = now[section].findIndex(entry => entry.countdown.key === key)
      const gone = { key, section, index, entry: now[section][index] }
      setLeaving(list => [...list, gone])
      const timer = setTimeout(() => {
        leavingTimers.current.delete(timer)
        setLeaving(list => list.filter(item => item !== gone))
      }, REMOVE_MS + 40)
      leavingTimers.current.add(timer)
    }
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
      focusLater(`${rowSelector(key)} .cd-row`)
    } else {
      onClose()
    }
  }

  // One countdown. `order` is its place in the list, which sets when it arrives while the drawer is
  // opening; `removing` is a deleted one on its way out.
  const renderEntry = ({ countdown, status, removing }, order) => {
    const open = openKey === countdown.key
    const classes = ['cd-item']
    if (open) classes.push('is-open')
    if (status.ended) classes.push('is-ended')
    if (flashKey === countdown.key) classes.push('is-new')
    if (removing) classes.push('is-removing')
    return (
      <div
        key={countdown.key}
        data-key={countdown.key}
        className={classes.join(' ')}
        style={{ '--cd-i': Math.min(order, 9) }}
        inert={removing ? '' : undefined}
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
        <Unfold show={open} duration={EDITOR_MS}>
          {open && (
            <CountdownEditor
              countdown={countdown}
              onPatch={changes => patch(countdown.key, changes)}
              onDelete={() => remove(countdown.key)}
            />
          )}
        </Unfold>
      </div>
    )
  }
  let order = 0
  const renderEntries = (entries) => entries.map(entry => renderEntry(entry, order++))

  return (
    <aside ref={rootRef} className={`cd-drawer ${entering ? 'is-entering' : ''}`} aria-label="倒数日" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="cd-drawer-head">
        <h2>倒数日</h2>
        <span className="cd-drawer-sub">{countdowns.length} 个 · 修改即时保存</span>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="关闭倒数日" onClick={onClose}>✕</button>
      </div>

      <div className="cd-drawer-body">
        {/* The way to add one and the form take each other's place by folding open and shut. The
         * button's slot is the one that stays at the top of the scrolling list. */}
        <Unfold show={!adding} duration={FORM_MS} className="cd-new-slot">
          <button type="button" className="cd-new" data-cd-new onClick={() => startAdding()}>＋ 新建倒数日</button>
        </Unfold>
        <Unfold show={adding} duration={FORM_MS}>
          {adding && (
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
          )}
        </Unfold>

        {countdowns.length === 0 && (
          <p className="cd-empty">还没有倒数日。记下生日、考试、出发日……每个都能设为每周、每月或每年重复。</p>
        )}

        {shown.upcoming.length > 0 && (
          <section aria-label="即将到来">
            <div className="cd-group">即将到来 · {shown.upcoming.length}</div>
            {renderEntries(shown.upcoming)}
          </section>
        )}

        {shown.unreadable.length > 0 && (
          <section aria-label="日期无法识别">
            <div className="cd-group">日期无法识别 · {shown.unreadable.length}</div>
            {renderEntries(shown.unreadable)}
          </section>
        )}

        {shown.ended.length > 0 && (
          <section aria-label="已结束">
            <button type="button" className="cd-group cd-group-toggle" aria-expanded={endedOpen} onClick={() => setShowEnded(!endedOpen)}>
              <span className="cd-group-caret" aria-hidden="true">▸</span>
              已结束 · {shown.ended.length}
            </button>
            <Unfold show={endedOpen}>{endedOpen && renderEntries(shown.ended)}</Unfold>
          </section>
        )}
      </div>
    </aside>
  )
}
