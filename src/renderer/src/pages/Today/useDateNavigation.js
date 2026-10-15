import { useCallback, useEffect, useRef, useState } from 'react'
import { isToday } from 'date-fns'
import { useApp } from '../../context/AppContext'

// How long the current day fades out before the next one is selected.
const DATE_LEAVE_MS = 140
// Matches returnToTodayIn / returnToTodayOut in Today.css.
const RETURN_TODAY_MS = 260

/**
 * Moving between days: the leave / enter transition, saving before leaving, and the
 * "back to today" button that slides in and out as the selected day stops being today.
 *
 * `flushDay` writes the day's pending edits; if that fails the move is cancelled so no edit is
 * lost, and `onSaveFailed` lets the page show the failed state.
 */
export function useDateNavigation({ selectedDate, setSelectedDate, flushDay, onSaveFailed }) {
  const { showToast } = useApp()
  const [dateLeaving, setDateLeaving] = useState(false)
  const [dateLeavingDir, setDateLeavingDir] = useState('jump')
  const [dateTransitionDir, setDateTransitionDir] = useState('jump')
  const [returnTodayPhase, setReturnTodayPhase] = useState(() => (
    isToday(selectedDate) ? 'hidden' : 'visible'
  ))
  const dateSwitchTimerRef = useRef(null)
  const returnTodayTimerRef = useRef(null)
  const returnTodayPhaseRef = useRef(returnTodayPhase)
  returnTodayPhaseRef.current = returnTodayPhase

  useEffect(() => () => {
    clearTimeout(dateSwitchTimerRef.current)
    clearTimeout(returnTodayTimerRef.current)
  }, [])

  const transitionReturnTodayButton = useCallback((phase, settledPhase) => {
    if (returnTodayTimerRef.current) clearTimeout(returnTodayTimerRef.current)
    returnTodayPhaseRef.current = phase
    setReturnTodayPhase(phase)
    if (!settledPhase) return

    returnTodayTimerRef.current = setTimeout(() => {
      returnTodayTimerRef.current = null
      returnTodayPhaseRef.current = settledPhase
      setReturnTodayPhase(settledPhase)
    }, RETURN_TODAY_MS)
  }, [])

  const goTo = useCallback(async (date) => {
    const currentTime = selectedDate.getTime()
    const nextTime = date.getTime()
    if (nextTime === currentTime) return
    const nextDir = nextTime > currentTime ? 'next' : 'prev'

    // Start fading the current day out right away; saving happens while it plays.
    setDateLeavingDir(nextDir)
    setDateLeaving(true)
    const result = await flushDay()
    if (!result.ok) {
      setDateLeaving(false)
      onSaveFailed()
      showToast('切换日期时保存失败，已保留当前编辑', 'error')
      return
    }

    const targetIsToday = isToday(date)
    const returnPhase = returnTodayPhaseRef.current
    if (targetIsToday && returnPhase !== 'hidden' && returnPhase !== 'leaving') {
      transitionReturnTodayButton('leaving', 'hidden')
    } else if (!targetIsToday && (returnPhase === 'hidden' || returnPhase === 'leaving')) {
      transitionReturnTodayButton('entering', 'visible')
    }
    if (dateSwitchTimerRef.current) clearTimeout(dateSwitchTimerRef.current)
    dateSwitchTimerRef.current = setTimeout(() => {
      dateSwitchTimerRef.current = null
      setDateTransitionDir(nextDir)
      setSelectedDate(date)
      setDateLeaving(false)
    }, DATE_LEAVE_MS)
  }, [selectedDate, flushDay, onSaveFailed, showToast, setSelectedDate, transitionReturnTodayButton])

  const returnToToday = useCallback(() => {
    if (returnTodayPhaseRef.current === 'leaving') return
    goTo(new Date())
  }, [goTo])

  return { dateLeaving, dateLeavingDir, dateTransitionDir, returnTodayPhase, goTo, returnToToday }
}
