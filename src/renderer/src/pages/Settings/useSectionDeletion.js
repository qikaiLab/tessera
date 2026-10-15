import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasStoredValue } from '../../utils/dayEntries'

const NO_REQUEST = { isOpen: false, sec: null, hasData: false, checking: false }

/**
 * Deleting a section: asking first, and refusing when any day holds data for it (so history
 * stays whole). `request` is what DeleteSectionDialog shows.
 */
export function useSectionDeletion() {
  const { sections, saveSections, showToast, datesWithData, readDayData } = useApp()
  const [request, setRequest] = useState(NO_REQUEST)

  const requestDelete = async (id) => {
    const sec = sections.find(s => s.id === id)
    if (!sec) return
    setRequest({ isOpen: true, sec, hasData: false, checking: true })
    let hasData = false
    for (const dateStr of datesWithData) {
      if (hasStoredValue((await readDayData(dateStr))[id])) {
        hasData = true
        break
      }
    }
    setRequest({ isOpen: true, sec, hasData, checking: false })
  }

  const cancel = () => setRequest(NO_REQUEST)

  const confirmDelete = async () => {
    if (request.sec) {
      await saveSections(sections.filter(s => s.id !== request.sec.id))
      showToast('已删除版块', 'success')
    }
    setRequest(NO_REQUEST)
  }

  return { request, requestDelete, cancel, confirmDelete }
}
