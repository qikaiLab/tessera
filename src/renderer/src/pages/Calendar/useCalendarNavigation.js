import { useState } from 'react'
import { addMonths, addWeeks, addYears, subMonths, subWeeks, subYears } from 'date-fns'

const STEP = {
  month: { next: addMonths, prev: subMonths },
  week: { next: addWeeks, prev: subWeeks },
  year: { next: addYears, prev: subYears }
}

/**
 * Which view (month / week / year) and period the calendar shows. `motion` says which way it
 * just moved ('next' | 'prev' | 'view'), so the new page can arrive from that side.
 */
export function useCalendarNavigation() {
  const [view, setViewState] = useState('month')
  const [cursor, setCursor] = useState(new Date())
  const [motion, setMotion] = useState('none')

  const setView = (next) => {
    if (next === view) return
    setMotion('view')
    setViewState(next)
  }

  const goToToday = () => {
    setMotion(new Date() >= cursor ? 'next' : 'prev')
    setCursor(new Date())
  }

  const step = (direction) => {
    setMotion(direction > 0 ? 'next' : 'prev')
    setCursor(prev => STEP[view][direction > 0 ? 'next' : 'prev'](prev, 1))
  }

  return { view, setView, cursor, motion, goToToday, step }
}
