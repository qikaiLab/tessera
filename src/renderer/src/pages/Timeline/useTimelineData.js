import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'

/**
 * Every recorded day's entries, keyed by date, read in parallel whenever the list of recorded
 * days changes. `setLoading` lets an operation that rewrites days show the spinner meanwhile.
 */
export function useTimelineData() {
  const { datesWithData, readDayData } = useApp()
  const [loading, setLoading] = useState(true)
  const [loadedDates, setLoadedDates] = useState({})

  useEffect(() => {
    if (!datesWithData.length) {
      setLoading(false)
      return undefined
    }
    setLoading(true)
    let aborted = false
    const loadAll = async () => {
      const entries = await Promise.all(datesWithData.map(async (dateStr) => [dateStr, await readDayData(dateStr)]))
      if (aborted) return
      setLoadedDates(Object.fromEntries(entries))
      setLoading(false)
    }
    loadAll()
    return () => { aborted = true }
  }, [datesWithData, readDayData])

  return { loadedDates, loading, setLoading }
}
