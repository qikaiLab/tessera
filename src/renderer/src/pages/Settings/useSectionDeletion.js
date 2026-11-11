import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasStoredValue } from '../../utils/dayEntries'

const NO_REQUEST = { isOpen: false, sec: null, hasData: false, unreadable: [], checking: false }
// How many days are read at once while checking the history.
const CHECK_CHUNK = 24

/**
 * Deleting a section: asking first, and refusing when any day holds data for it (so history
 * stays whole), or when a day cannot be read, since nothing can then be said about what it holds.
 * `request` is what DeleteSectionDialog shows.
 */
export function useSectionDeletion() {
  const { sections, saveSections, showToast, datesWithData, readDayDataStrict } = useApp()
  const [request, setRequest] = useState(NO_REQUEST)
  // Which request the history check belongs to: cancelling, or asking about another section,
  // makes the check still running obsolete, and its answer must not open the dialog again.
  const checkRef = useRef(0)

  const requestDelete = async (id) => {
    const sec = sections.find(s => s.id === id)
    if (!sec) return
    const check = checkRef.current + 1
    checkRef.current = check
    setRequest({ isOpen: true, sec, hasData: false, unreadable: [], checking: true })
    let hasData = false
    const unreadable = []
    for (let start = 0; start < datesWithData.length && !hasData; start += CHECK_CHUNK) {
      // A day that cannot be read is not an empty day (null, not {}).
      const chunk = datesWithData.slice(start, start + CHECK_CHUNK)
      const days = await Promise.all(chunk.map(dateStr => readDayDataStrict(dateStr).catch(() => null)))
      if (checkRef.current !== check) return
      days.forEach((day, index) => { if (day === null) unreadable.push(chunk[index]) })
      hasData = days.some(day => day !== null && hasStoredValue(day[id]))
    }
    if (checkRef.current !== check) return
    setRequest({ isOpen: true, sec, hasData, unreadable: hasData ? [] : unreadable, checking: false })
  }

  const cancel = () => {
    checkRef.current += 1
    setRequest(NO_REQUEST)
  }

  const confirmDelete = async () => {
    if (request.sec) {
      if (await saveSections(sections.filter(s => s.id !== request.sec.id))) showToast('已删除版块', 'success')
    }
    checkRef.current += 1
    setRequest(NO_REQUEST)
  }

  return { request, requestDelete, cancel, confirmDelete }
}
