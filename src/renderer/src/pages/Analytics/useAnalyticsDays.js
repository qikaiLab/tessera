import { useEffect, useState } from 'react'

/**
 * Every recorded day's entries, keyed by date, read in parallel whenever the list of recorded
 * days changes. Days that cannot be read or parsed are left out.
 */
export function useAnalyticsDays(datesWithData) {
  const [loadedData, setLoadedData] = useState({})

  useEffect(() => {
    if (!datesWithData.length) {
      setLoadedData({})
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
      if (!aborted) setLoadedData(Object.fromEntries(entries.filter(Boolean)))
    }
    loadAll()
    return () => { aborted = true }
  }, [datesWithData])

  return loadedData
}
