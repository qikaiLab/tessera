import { useCallback, useState } from 'react'

/**
 * Collapsed record cards, keyed by date + section. Session-only on purpose: a card collapsed on
 * one day must never hide the writing area on another.
 */
export function useCollapsedCards(dateStr) {
  const [collapsed, setCollapsed] = useState(() => new Set())

  const isCollapsed = useCallback((sectionId) => collapsed.has(`${dateStr}:${sectionId}`), [collapsed, dateStr])

  const toggleCollapsed = useCallback((sectionId) => {
    const key = `${dateStr}:${sectionId}`
    setCollapsed(prev => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [dateStr])

  return { isCollapsed, toggleCollapsed }
}
