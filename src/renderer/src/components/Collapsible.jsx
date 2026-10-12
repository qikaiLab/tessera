import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { collapseDurationMs } from '../utils/collapseMotion'
import './Collapsible.css'

/**
 * Opens and closes its content with a height animation (grid row 0fr <-> 1fr), taking longer
 * for taller content. The children stay mounted until the closing animation has finished, so
 * pass `null` once there is nothing to show; the last non-null children are kept for the exit.
 *
 * It never fades itself: a fading ancestor would flatten the frosted-glass backdrop of whatever
 * glass lives inside. Style `.collapsible-inner > *` to fade the content instead.
 */
export default function Collapsible({ open, children, className = '' }) {
  const rootRef = useRef(null)
  const innerRef = useRef(null)
  const lastChildren = useRef(children)
  if (open && children) lastChildren.current = children

  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)
  const firstRun = useRef(true)

  useLayoutEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return undefined
    }
    const duration = collapseDurationMs(innerRef.current?.scrollHeight)
    rootRef.current?.style.setProperty('--collapse-ms', `${duration}ms`)
    if (open) {
      setMounted(true)
      // Start the transition on a frame after the content exists, so it has a height to grow to.
      let second = 0
      const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setShown(true)) })
      return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
    }
    setShown(false)
    const timer = setTimeout(() => setMounted(false), duration + 60)
    return () => clearTimeout(timer)
  }, [open])

  // Keep the mounted flag honest if `open` was already true on mount and later content vanishes.
  useEffect(() => {
    if (open && !mounted) setMounted(true)
  }, [open, mounted])

  const content = mounted ? (open ? children : lastChildren.current) : null
  return (
    <div
      ref={rootRef}
      className={`collapsible ${shown ? 'is-open' : ''} ${className}`}
      aria-hidden={shown ? undefined : true}
      inert={shown ? undefined : ''}
    >
      <div ref={innerRef} className="collapsible-inner">{content}</div>
    </div>
  )
}
