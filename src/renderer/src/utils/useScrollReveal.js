import { useCallback, useEffect, useRef } from 'react'

const STAGGER_MS = 34
const MAX_STAGGERED = 10

/**
 * Reveals list items as they scroll into view, once each, with a short cascade for items that
 * arrive together (a tall window shows a screenful at once; scrolling brings in one or two).
 * Items start hidden through CSS on `[data-reveal='pending']` and play their entrance when this
 * hook flips the attribute to `in`. A data attribute (not a class) is used so that React,
 * re-rendering the item's className, can never undo the reveal.
 *
 * Returns a ref callback: <div data-reveal="pending" ref={reveal} />
 */
export function useScrollReveal() {
  const observerRef = useRef(null)

  useEffect(() => () => {
    observerRef.current?.disconnect()
    observerRef.current = null
  }, [])

  return useCallback((element) => {
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      element.dataset.reveal = 'in'
      return
    }
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        const arriving = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        arriving.forEach((entry, index) => {
          const target = entry.target
          target.style.setProperty('--reveal-delay', `${Math.min(index, MAX_STAGGERED) * STAGGER_MS}ms`)
          target.dataset.reveal = 'in'
          observerRef.current?.unobserve(target)
        })
      }, { threshold: 0.04 })
    }
    if (element.dataset.reveal !== 'in') observerRef.current.observe(element)
  }, [])
}
