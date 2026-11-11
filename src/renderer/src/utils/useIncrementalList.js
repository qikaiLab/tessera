import { useEffect, useState } from 'react'

/**
 * Renders a long list in batches: the first `pageSize` items immediately, then another
 * batch each time the sentinel scrolls near the viewport. Keeps the DOM (and memory)
 * small for years of history. `resetKey` restarts from the first batch when the result
 * set changes. `sentinelRef` is a callback ref: the observer follows whichever element is the
 * sentinel right now, so it survives the list being replaced (preview mode, a loading spinner) and
 * coming back as a new element.
 */
export function useIncrementalList(items, pageSize, resetKey) {
  const [count, setCount] = useState(pageSize)
  const [sentinel, setSentinel] = useState(null)
  const hasMore = count < items.length

  useEffect(() => {
    setCount(pageSize)
  }, [resetKey, pageSize])

  useEffect(() => {
    if (!sentinel || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) setCount(current => current + pageSize)
    }, { rootMargin: '600px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, resetKey, hasMore, pageSize])

  return {
    visible: items.slice(0, count),
    hasMore,
    remaining: Math.max(0, items.length - count),
    sentinelRef: setSentinel,
    showMore: () => setCount(current => current + pageSize)
  }
}
