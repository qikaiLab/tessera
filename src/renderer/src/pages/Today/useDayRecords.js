import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasStoredValue } from '../../utils/dayEntries'
import { handOverPendingWrite, markWritten } from '../../utils/leftoverSaves'
import { flushPendingValue } from '../../utils/pendingSaves'
import { NUMBER_DEFAULT_MODE, getNumberDefaultMode } from '../../utils/sectionDefaults'

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

/**
 * The records of one day: loading them, the number defaults shown for empty number sections,
 * editing and debounced saving (plus flushing before the window closes or the day changes).
 *
 * Returned `holding` is true between the day changing and its data arriving: the page shows
 * nothing then, instead of the previous day's cards under the new date.
 */
export function useDayRecords({ dateStr, sections }) {
  const {
    readDayData, readDayDataStrict, writeDayData, datesWithData, registerPendingFlush, unregisterPendingFlush, showToast
  } = useApp()

  const [data, setData] = useState({})
  const [numberDefaults, setNumberDefaults] = useState({})
  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.IDLE)
  const [loading, setLoading] = useState(true)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [loadedDateStr, setLoadedDateStr] = useState(null)
  // Set when the day's file exists but could not be read: the page shows why instead of an empty
  // day, because typing into an "empty" day would write over the real one.
  const [loadError, setLoadError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  // `dataRef` is the source of truth between renders, so several edits in a row never lose one.
  const dataRef = useRef({})
  const saveTimerRef = useRef(null)
  const pendingDataRef = useRef(null)
  // The day the pending edits belong to (not necessarily the day on screen by the time they are written).
  const pendingDateRef = useRef(null)
  const loadedDateRef = useRef(null)
  const saveFailureShownRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)
  const loadSeqRef = useRef(0)
  const datesWithDataRef = useRef(datesWithData)
  datesWithDataRef.current = datesWithData
  const dateStrRef = useRef(dateStr)
  dateStrRef.current = dateStr

  // Writes one day's data and notes that newer content of that day exists.
  const writeDay = useCallback(async (date, value) => {
    const result = await writeDayData(date, value)
    if (result.ok) markWritten(`day:${date}`)
    return result
  }, [writeDayData])

  const writePending = useCallback(
    value => writeDay(pendingDateRef.current ?? dateStrRef.current, value),
    [writeDay]
  )

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
      defaults[section.id] = getNumberDefaultMode(section) === NUMBER_DEFAULT_MODE.CARRY
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
    setLoadError(null)
    setShowSkeleton(false)
    setSaveStatus(SAVE_STATUS.IDLE)
    setNumberDefaults({})
    if (!hasLoadedOnce) skeletonTimer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS)

    readDayDataStrict(dateStr)
      .then(async loaded => {
        const defaults = await buildNumberDefaults(dateStr, loaded)
        if (loadSeqRef.current !== seq) return
        dataRef.current = loaded
        loadedDateRef.current = dateStr
        setData(loaded)
        setNumberDefaults(defaults)
      })
      .catch(error => {
        console.error('Failed to load day data:', error)
        if (loadSeqRef.current !== seq) return
        // Never keep showing another day's cards, and never offer an empty day to type into:
        // edits would be saved over the day that could not be read.
        dataRef.current = {}
        loadedDateRef.current = null
        setData({})
        setLoadError(error.message)
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
  }, [dateStr, reloadTick, readDayDataStrict, buildNumberDefaults])

  const retryLoad = useCallback(() => setReloadTick(tick => tick + 1), [])

  const scheduleSave = useCallback((nextData) => {
    pendingDataRef.current = nextData
    pendingDateRef.current = loadedDateRef.current ?? dateStrRef.current
    setSaveStatus(SAVE_STATUS.UNSAVED)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus(SAVE_STATUS.SAVING)
      saveTimerRef.current = null
      const result = await flushPendingValue(pendingDataRef, writePending)
      if (result.ok) {
        saveFailureShownRef.current = false
        setSaveStatus(SAVE_STATUS.SAVED)
        setTimeout(() => setSaveStatus(SAVE_STATUS.IDLE), SAVED_BADGE_MS)
      } else {
        setSaveStatus(SAVE_STATUS.FAILED)
        // The edit stays pending (a later save, leaving the day or closing retries it); say so once.
        if (!saveFailureShownRef.current) {
          saveFailureShownRef.current = true
          showToast('保存失败，改动仍保留在页面中，请稍后重试保存或先复制内容', 'error', 8000)
        }
      }
    }, SAVE_DEBOUNCE_MS)
  }, [writePending, showToast])

  // Writes whatever is pending right now (cancelling the debounce).
  const flushNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    return flushPendingValue(pendingDataRef, writePending)
  }, [writePending])

  // Lets the app flush this page before the window closes.
  useEffect(() => {
    registerPendingFlush('today', flushNow)
    return () => unregisterPendingFlush('today')
  }, [flushNow, registerPendingFlush, unregisterPendingFlush])

  // Leaving the page with an edit still pending (the debounce has not fired yet, or the last save
  // failed): hand it over instead of dropping it; it keeps being retried until it is on disk.
  const leaveRef = useRef(null)
  leaveRef.current = { writeDay, registerPendingFlush, unregisterPendingFlush, showToast }
  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const value = pendingDataRef.current
    const date = pendingDateRef.current
    if (value === null || !date) return
    pendingDataRef.current = null
    const { writeDay: write, registerPendingFlush: register, unregisterPendingFlush: unregister, showToast: toast } = leaveRef.current
    handOverPendingWrite({
      key: `day:${date}`,
      write: () => write(date, value),
      registerPendingFlush: register,
      unregisterPendingFlush: unregister,
      onFailure: () => toast(`${date} 的记录保存失败，退出软件前会再次尝试保存`, 'error', 8000)
    })
  }, [])

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
    loadError,
    retryLoad,
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
