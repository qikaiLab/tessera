import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasStoredValue } from '../../utils/dayEntries'
import { flushPendingValue } from '../../utils/pendingSaves'

export const SAVE_STATUS = {
  SAVED: 'saved',
  UNSAVED: 'unsaved',
  SAVING: 'saving',
  FAILED: 'failed',
  IDLE: 'idle'
}

const SAVE_DEBOUNCE_MS = 800
const SAVED_BADGE_MS = 2000
// A first load that takes longer than this shows skeleton cards instead of an empty page.
const SKELETON_DELAY_MS = 180
const NUMBER_DEFAULT_MODE_CARRY = 'carry'

const getNumberDefaultMode = (section) => (
  section?.numberDefaultMode === NUMBER_DEFAULT_MODE_CARRY ? NUMBER_DEFAULT_MODE_CARRY : 'manual'
)

/**
 * The records of one day: loading them, the number defaults shown for empty number sections,
 * editing and debounced saving (plus flushing before the window closes or the day changes).
 *
 * Returned `holding` is true between the day changing and its data arriving: the page shows
 * nothing then, instead of the previous day's cards under the new date.
 */
export function useDayRecords({ dateStr, sections }) {
  const {
    readDayData, writeDayData, datesWithData, registerPendingFlush, unregisterPendingFlush, showToast
  } = useApp()

  const [data, setData] = useState({})
  const [numberDefaults, setNumberDefaults] = useState({})
  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.IDLE)
  const [loading, setLoading] = useState(true)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [loadedDateStr, setLoadedDateStr] = useState(null)

  // `dataRef` is the source of truth between renders, so several edits in a row never lose one.
  const dataRef = useRef({})
  const saveTimerRef = useRef(null)
  const pendingDataRef = useRef(null)
  const hasLoadedOnceRef = useRef(false)
  const loadSeqRef = useRef(0)
  const datesWithDataRef = useRef(datesWithData)
  datesWithDataRef.current = datesWithData
  const dateStrRef = useRef(dateStr)
  dateStrRef.current = dateStr

  const findRecentNumberValue = useCallback(async (targetDateStr, sectionId) => {
    const candidates = datesWithDataRef.current
      .filter(d => d < targetDateStr)
      .sort((a, b) => b.localeCompare(a))

    for (const d of candidates) {
      const entry = (await readDayData(d))[sectionId]
      if (hasStoredValue(entry)) return String(entry.value)
    }
    return '0'
  }, [readDayData])

  const buildNumberDefaults = useCallback(async (targetDateStr, loadedData) => {
    const defaults = {}
    for (const section of sections) {
      if (section.type !== 'number' || hasStoredValue(loadedData[section.id])) continue
      defaults[section.id] = getNumberDefaultMode(section) === NUMBER_DEFAULT_MODE_CARRY
        ? await findRecentNumberValue(targetDateStr, section.id)
        : '0'
    }
    return defaults
  }, [findRecentNumberValue, sections])

  useEffect(() => {
    const seq = loadSeqRef.current + 1
    loadSeqRef.current = seq
    const hasLoadedOnce = hasLoadedOnceRef.current
    let skeletonTimer = null

    setLoading(!hasLoadedOnce)
    setShowSkeleton(false)
    setSaveStatus(SAVE_STATUS.IDLE)
    setNumberDefaults({})
    if (!hasLoadedOnce) skeletonTimer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS)

    readDayData(dateStr)
      .then(async loaded => {
        const defaults = await buildNumberDefaults(dateStr, loaded)
        if (loadSeqRef.current !== seq) return
        dataRef.current = loaded
        setData(loaded)
        setNumberDefaults(defaults)
      })
      .catch(error => {
        console.error('Failed to load day data:', error)
        if (loadSeqRef.current !== seq) return
        // Never keep showing another day's cards under this date: edits would be saved into it.
        dataRef.current = {}
        setData({})
        showToast('读取记录失败', 'error')
      })
      .finally(() => {
        if (loadSeqRef.current !== seq) return
        hasLoadedOnceRef.current = true
        setLoading(false)
        setShowSkeleton(false)
        setLoadedDateStr(dateStr)
      })

    return () => {
      if (skeletonTimer) clearTimeout(skeletonTimer)
    }
  }, [dateStr, readDayData, showToast, buildNumberDefaults])

  const scheduleSave = useCallback((nextData) => {
    pendingDataRef.current = nextData
    setSaveStatus(SAVE_STATUS.UNSAVED)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus(SAVE_STATUS.SAVING)
      saveTimerRef.current = null
      const result = await flushPendingValue(pendingDataRef, value => writeDayData(dateStrRef.current, value))
      if (result.ok) {
        setSaveStatus(SAVE_STATUS.SAVED)
        setTimeout(() => setSaveStatus(SAVE_STATUS.IDLE), SAVED_BADGE_MS)
      } else {
        setSaveStatus(SAVE_STATUS.FAILED)
      }
    }, SAVE_DEBOUNCE_MS)
  }, [writeDayData])

  // Writes whatever is pending right now (cancelling the debounce).
  const flushNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    return flushPendingValue(pendingDataRef, value => writeDayData(dateStrRef.current, value))
  }, [writeDayData])

  // Lets the app flush this page before the window closes.
  useEffect(() => {
    registerPendingFlush('today', flushNow)
    return () => unregisterPendingFlush('today')
  }, [flushNow, registerPendingFlush, unregisterPendingFlush])

  // The save shortcut inside an editor: write now and say how it went.
  const saveNow = useCallback(() => {
    if (!pendingDataRef.current) {
      showToast('暂无需要保存的更改', 'info', 1000)
      return
    }
    setSaveStatus(SAVE_STATUS.SAVING)
    flushNow().then(result => {
      if (result.ok) {
        setSaveStatus(SAVE_STATUS.SAVED)
        showToast('已保存更改', 'success', SAVED_BADGE_MS)
        setTimeout(() => setSaveStatus(SAVE_STATUS.IDLE), SAVED_BADGE_MS)
      } else {
        setSaveStatus(SAVE_STATUS.FAILED)
        showToast('保存失败', 'error')
      }
    })
  }, [flushNow, showToast])

  const commit = useCallback((update) => {
    const next = update(dataRef.current)
    dataRef.current = next
    setData(next)
    scheduleSave(next)
  }, [scheduleSave])

  // `value` is a Tiptap document or a number string.
  const changeValue = useCallback((sectionId, value) => {
    const serialized = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : value
    commit(prev => ({ ...prev, [sectionId]: { value: serialized, updatedAt: new Date().toISOString() } }))
  }, [commit])

  const removeEntry = useCallback((sectionId) => {
    commit(prev => {
      const next = { ...prev }
      delete next[sectionId]
      return next
    })
  }, [commit])

  const getEntry = useCallback((sectionId) => dataRef.current[sectionId], [])
  const reportSaveFailed = useCallback(() => setSaveStatus(SAVE_STATUS.FAILED), [])

  return {
    data,
    numberDefaults,
    loading,
    showSkeleton,
    holding: loadedDateStr !== null && loadedDateStr !== dateStr,
    saveStatus,
    reportSaveFailed,
    changeValue,
    removeEntry,
    getEntry,
    flushNow,
    saveNow,
    findRecentNumberValue
  }
}
