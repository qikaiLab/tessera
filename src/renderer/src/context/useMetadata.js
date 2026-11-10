import { useCallback, useEffect, useRef, useState } from 'react'
import { createCoalescedWriter } from '../utils/coalescedWriter'
import { buildMetadataContent, toggleFavoriteEntry } from '../utils/favorites'
import { clearLegacyMetadata, parseMetadata } from './metadataFile'

/**
 * Countdowns, analytics charts and favourites: kept in metadata.json next to the data, written
 * shortly after a change (see coalescedWriter: one write at a time, a change made during a write is
 * written after it, a failed write is retried) and flushed before the window closes.
 */
export function useMetadata({ registerPendingFlush, unregisterPendingFlush, showToast }) {
  const [countdowns, setCountdowns] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [favorites, setFavorites] = useState([])
  // The latest values, readable at the moment a write actually happens.
  const stateRef = useRef({ countdowns: [], analytics: [], favorites: [] })
  const failureShownRef = useRef(false)
  const toastRef = useRef(showToast)
  toastRef.current = showToast

  const writerRef = useRef(null)
  if (!writerRef.current) {
    writerRef.current = createCoalescedWriter({
      write: () => window.api.metadata.set(buildMetadataContent(stateRef.current)),
      onSuccess: () => { failureShownRef.current = false },
      onFailure: () => {
        if (failureShownRef.current) return
        failureShownRef.current = true
        toastRef.current?.('倒数日、图表或收藏的更改保存失败，将自动重试；退出软件前也会再次尝试', 'error', 8000)
      }
    })
  }

  const commit = useCallback((patch) => {
    stateRef.current = { ...stateRef.current, ...patch }
    if ('countdowns' in patch) setCountdowns(patch.countdowns)
    if ('analytics' in patch) setAnalytics(patch.analytics)
    if ('favorites' in patch) setFavorites(patch.favorites)
    writerRef.current.markDirty()
  }, [])

  const loadMetadata = useCallback(async () => {
    const res = await window.api.metadata.get()
    if (!res.ok) return false
    try {
      const parsed = parseMetadata(res.data, localStorage)
      stateRef.current = { countdowns: parsed.countdowns, analytics: parsed.analytics, favorites: parsed.favorites }
      setCountdowns(parsed.countdowns)
      setAnalytics(parsed.analytics)
      setFavorites(parsed.favorites)
      if (parsed.migrated) {
        // Older versions kept these in localStorage: move them into metadata.json.
        const migrated = await window.api.metadata.set(buildMetadataContent({
          countdowns: parsed.countdowns,
          analytics: parsed.analytics,
          favorites: parsed.rawFavorites
        }))
        // The old copy is only dropped once the new file is safely on disk.
        if (migrated?.ok) clearLegacyMetadata(localStorage)
      }
      return true
    } catch (error) {
      console.error('Failed to parse metadata.json:', error)
      return false
    }
  }, [])

  // Like a state setter: `next` is the new list or a function of the latest one (several quick
  // changes in a row each build on the one before).
  const saveCountdowns = useCallback((next) => {
    commit({ countdowns: typeof next === 'function' ? next(stateRef.current.countdowns) : next })
  }, [commit])
  const saveAnalytics = useCallback((next) => {
    commit({ analytics: typeof next === 'function' ? next(stateRef.current.analytics) : next })
  }, [commit])
  const toggleFavorite = useCallback((dateStr, sectionId) => {
    commit({ favorites: toggleFavoriteEntry(stateRef.current.favorites, dateStr, sectionId) })
  }, [commit])

  // Before the window closes: wait for a write in flight, then write anything still pending.
  useEffect(() => {
    registerPendingFlush('metadata', () => writerRef.current.flush())
    return () => unregisterPendingFlush('metadata')
  }, [registerPendingFlush, unregisterPendingFlush])

  return {
    countdowns, saveCountdowns,
    analytics, saveAnalytics,
    favorites, toggleFavorite,
    loadMetadata
  }
}
