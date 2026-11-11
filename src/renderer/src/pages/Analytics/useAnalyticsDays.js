import { useEffect, useState } from 'react'

/**
 * Every recorded day's entries, keyed by date, read in parallel whenever the list of recorded
 * days changes. Days that cannot be read or parsed are left out. `loading` is true only until the
 * first read has finished (a later re-read keeps showing what it has), so a chart can tell
 * "still reading" from "nothing recorded in this range".
 */
export function useAnalyticsDays(datesWithData) {
  const [loadedData, setLoadedData] = useState({})
  const [loading, setLoading] = useState(datesWithData.length > 0)

  useEffect(() => {
    if (!datesWithData.length) {
      setLoadedData({})
      setLoading(false)
      return undefined
    }
    let aborted = false

    const loadAll = async () => {
      const entries = await Promise.all(datesWithData.map(async (dateStr) => {
        const [year, month, day] = dateStr.split('-')
        const result = await window.api.fs.readFile(`${year}/${month}/${day}.json`)
        if (!result.ok) return null
        try {
          return [dateStr, JSON.parse(result.data)]
        } catch (error) {
          console.error(`Failed to parse ${dateStr}:`, error)
          return null
        }
      }))
      if (aborted) return
      setLoadedData(Object.fromEntries(entries.filter(Boolean)))
      setLoading(false)
    }
    loadAll()
    return () => { aborted = true }
  }, [datesWithData])

  return { loadedData, loading }
}
