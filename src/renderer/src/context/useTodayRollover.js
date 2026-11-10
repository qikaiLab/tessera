import { useEffect, useRef } from 'react'
import { isSameDay, startOfDay } from 'date-fns'

const CHECK_INTERVAL_MS = 30000

/**
 * What a new calendar day means for the selected day. The record page was opened on "today"; when
 * midnight passes with the app still open it must move on to the new day, or everything typed
 * after midnight is saved under yesterday's date.
 *   'same-day'  still the same day: nothing to do
 *   'keep'      a new day began, but the user was looking at another day: leave their choice alone
 *   'advance'   a new day began and the selected day was the old "today": move to the new one
 */
export function decideRollover({ lastSeenToday, now, selected }) {
  if (isSameDay(now, lastSeenToday)) return 'same-day'
  return isSameDay(selected, lastSeenToday) ? 'advance' : 'keep'
}

/**
 * Notices the day changing (a timer, and on regaining focus, which also covers a laptop that
 * slept through midnight) and moves the selected day on when it was "today". Pending edits are
 * written first; if that fails the page stays on the old day so nothing is lost.
 */
export function useTodayRollover({ selectedDate, setSelectedDate, flushPendingSaves, showToast }) {
  const lastSeenTodayRef = useRef(startOfDay(new Date()))
  const latestRef = useRef({})
  latestRef.current = { selectedDate, setSelectedDate, flushPendingSaves, showToast }
  const busyRef = useRef(false)
  const warnedRef = useRef(false)

  useEffect(() => {
    const check = async () => {
      if (busyRef.current) return
      const { selectedDate: selected, setSelectedDate: select, flushPendingSaves: flush, showToast: toast } = latestRef.current
      const now = new Date()
      const decision = decideRollover({ lastSeenToday: lastSeenTodayRef.current, now, selected })
      if (decision === 'same-day') return
      if (decision === 'keep') {
        lastSeenTodayRef.current = startOfDay(now)
        return
      }
      busyRef.current = true
      try {
        if (!await flush()) {
          // Try again at the next check; the old day keeps its unsaved edits meanwhile.
          if (!warnedRef.current) {
            warnedRef.current = true
            toast?.('已经跨过零点，但当前内容保存失败，仍停留在前一天。保存成功后会自动切到今天。', 'error', 8000)
          }
          return
        }
        warnedRef.current = false
        lastSeenTodayRef.current = startOfDay(now)
        select(now)
      } finally {
        busyRef.current = false
      }
    }
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    const onVisible = () => { if (!document.hidden) check() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
