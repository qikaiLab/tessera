import { useCallback, useEffect, useRef, useState } from 'react'
import { buildMetadataContent, toggleFavoriteEntry } from '../utils/favorites'
import { clearLegacyMetadata, parseMetadata } from './metadataFile'

const METADATA_SAVE_DEBOUNCE_MS = 300
const METADATA_REWRITE_DELAY_MS = 50

/**
 * Countdowns, analytics charts and favourites: kept in metadata.json next to the data, written
 * shortly after a change, with one write in flight at a time (a change during a write triggers
 * another write after it) and flushed before the window closes.
 */
export function useMetadata({ registerPendingFlush, unregisterPendingFlush }) {
  const [countdowns, setCountdowns] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [favorites, setFavorites] = useState([])
  const timerRef = useRef(null)
  const hasChangedRef = useRef(false)
  const isWritingRef = useRef(false)
  const writeRef = useRef(Promise.resolve())
  const needsRewriteRef = useRef(false)
  const writeMetadataRef = useRef(null)

  const loadMetadata = useCallback(async () => {
    const res = await window.api.metadata.get()
    if (!res.ok) return false
    try {
      const parsed = parseMetadata(res.data, localStorage)
      setCountdowns(parsed.countdowns)
      setAnalytics(parsed.analytics)
      setFavorites(parsed.favorites)
      if (parsed.migrated) {
        // Older versions kept these in localStorage: move them into metadata.json.
        await window.api.metadata.set(buildMetadataContent({
          countdowns: parsed.countdowns,
          analytics: parsed.analytics,
          favorites: parsed.rawFavorites
        }))
        clearLegacyMetadata(localStorage)
      }
      return true
    } catch (error) {
      console.error('Failed to parse metadata.json:', error)
      return false
    }
  }, [])

  const saveCountdowns = useCallback((next) => {
    hasChangedRef.current = true
    setCountdowns(next)
  }, [])

  const saveAnalytics = useCallback((next) => {
    hasChangedRef.current = true
    setAnalytics(next)
  }, [])

  const toggleFavorite = useCallback((dateStr, sectionId) => {
    hasChangedRef.current = true
    setFavorites(prev => toggleFavoriteEntry(prev, dateStr, sectionId))
  }, [])

  const writeMetadata = useCallback(async () => {
    if (isWritingRef.current) {
      // A write is in progress: write again when it is done.
      needsRewriteRef.current = true
      return
    }
    isWritingRef.current = true
    try {
      // The state is committed before the debounce timer fires, so this closure is current.
      writeRef.current = window.api.metadata.set(buildMetadataContent({ countdowns, analytics, favorites }))
      const result = await writeRef.current
      if (!result.ok) hasChangedRef.current = true
    } catch (error) {
      hasChangedRef.current = true
      console.error('Failed to write metadata:', error)
    } finally {
      isWritingRef.current = false
      if (needsRewriteRef.current) {
        needsRewriteRef.current = false
        // Changes arrived during the write: write again on the next tick, with the latest state
        // (this closure's own state is already stale by then, so go through the ref).
        setTimeout(() => {
          if (hasChangedRef.current) {
            hasChangedRef.current = false
            writeMetadataRef.current?.()
          }
        }, METADATA_REWRITE_DELAY_MS)
      }
    }
  }, [countdowns, analytics, favorites])
  writeMetadataRef.current = writeMetadata

  useEffect(() => {
    if (!hasChangedRef.current) return undefined
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      hasChangedRef.current = false
      writeMetadata()
    }, METADATA_SAVE_DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [countdowns, analytics, favorites, writeMetadata])

  // Before the window closes: wait for a write in flight, then write anything still pending.
  useEffect(() => {
    const flushMetadata = async () => {
      try { await writeRef.current } catch { hasChangedRef.current = true }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (hasChangedRef.current || needsRewriteRef.current) {
        hasChangedRef.current = false
        needsRewriteRef.current = false
        const result = await window.api.metadata.set(buildMetadataContent({ countdowns, analytics, favorites }))
        if (!result.ok) {
          hasChangedRef.current = true
          return false
        }
      }
      return undefined
    }
    registerPendingFlush('metadata', flushMetadata)
    return () => unregisterPendingFlush('metadata')
  }, [countdowns, analytics, favorites, registerPendingFlush, unregisterPendingFlush])

  return {
    countdowns, saveCountdowns,
    analytics, saveAnalytics,
    favorites, toggleFavorite,
    loadMetadata
  }
}
