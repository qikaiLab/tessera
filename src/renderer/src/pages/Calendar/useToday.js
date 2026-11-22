import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'

const CHECK_INTERVAL_MS = 60_000

/**
 * The start of today, a new Date only when midnight passes while the page stays open (checked each
 * minute and when the window regains focus), so "today", the countdown figures and the strip never
 * show yesterday's date, and memoised values keyed on it are not rebuilt on every render.
 */
export function useToday() {
  const [key, setKey] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    const check = () => setKey(format(new Date(), 'yyyy-MM-dd'))
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [])

  return useMemo(() => {
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [key])
}
