import { useEffect, useRef, useState } from 'react'

/**
 * Renders a long list in batches: the first `pageSize` items immediately, then another
 * batch each time the sentinel scrolls near the viewport. Keeps the DOM (and memory)
 * small for years of history. `resetKey` restarts from the first batch when the result
 * set changes.
 */
export function useIncrementalList(items, pageSize, resetKey) {
  const [count, setCount] = useState(pageSize)
  const sentinelRef = useRef(null)
  const hasMore = count < items.length

  useEffect(() => {
    setCount(pageSize)
  }, [resetKey, pageSize])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) setCount(current => current + pageSize)
    }, { rootMargin: '600px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [resetKey, hasMore, pageSize])

  return {
    visible: items.slice(0, count),
    hasMore,
    remaining: Math.max(0, items.length - count),
    sentinelRef,
    showMore: () => setCount(current => current + pageSize)
  }
}
