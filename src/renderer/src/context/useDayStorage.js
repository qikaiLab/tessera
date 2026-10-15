import { useCallback, useState } from 'react'
import { dropEmptyEntries } from '../utils/dayEntries'

// A day lives in <year>/<month>/<day>.json under the data directory.
const dayPath = (dateStr) => {
  const [year, month, day] = dateStr.split('-')
  return `${year}/${month}/${day}.json`
}

/**
 * Reading and writing the records of a day, and the list of days that have any (`datesWithData`,
 * used by the calendar, the timeline and the number defaults).
 */
export function useDayStorage() {
  const [datesWithData, setDatesWithData] = useState([])

  // A day that is missing or cannot be parsed reads as empty; entries with nothing in them are
  // left out so they never show up on the record page.
  const readDayData = useCallback(async (dateStr) => {
    const result = await window.api.fs.readFile(dayPath(dateStr))
    if (!result.ok) return {}
    try {
      return dropEmptyEntries(JSON.parse(result.data))
    } catch (error) {
      console.error(`Failed to parse data for ${dateStr}:`, error)
      return {}
    }
  }, [])

  const refreshDates = useCallback(async () => {
    const rawDates = await window.api.fs.scanDates()
    const checked = await Promise.all(rawDates.map(async (dateStr) => (
      Object.keys(await readDayData(dateStr)).length > 0 ? dateStr : null
    )))
    const withData = checked.filter(Boolean)
    setDatesWithData(withData)
    return withData
  }, [readDayData])

  // Empty entries are not written; a day left with none has its file removed.
  const writeDayData = useCallback(async (dateStr, data) => {
    const cleaned = dropEmptyEntries(data)
    const hasRealContent = Object.keys(cleaned).length > 0
    const result = hasRealContent
      ? await window.api.fs.writeFile(dayPath(dateStr), JSON.stringify(cleaned, null, 2))
      : await window.api.fs.deleteFile(dayPath(dateStr))

    if (result.ok) {
      setDatesWithData(prev => {
        if (hasRealContent) return prev.includes(dateStr) ? prev : [...prev, dateStr]
        return prev.filter(d => d !== dateStr)
      })
    }
    return result
  }, [])

  return { datesWithData, refreshDates, readDayData, writeDayData }
}
