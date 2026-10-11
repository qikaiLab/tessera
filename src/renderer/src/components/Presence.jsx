import React, { useEffect, useReducer, useRef } from 'react'

/**
 * Keeps its child mounted for a moment after the parent stops rendering it, inside a
 * wrapper marked `is-leaving`, so CSS can play an exit animation before it disappears.
 *
 *   <Presence>{open && <div className="modal-overlay">…</div>}</Presence>
 *
 * The wrapper is `display: contents`, so it never affects layout. While leaving it shows
 * the last child it was given and ignores input (`inert`).
 */
export default function Presence({ children, duration = 160 }) {
  const lastRef = useRef(null)
  const [, rerender] = useReducer(count => count + 1, 0)
  const present = Boolean(children)
  if (present) lastRef.current = children
  const leaving = !present && lastRef.current !== null

  useEffect(() => {
    if (!leaving) return undefined
    const timer = setTimeout(() => {
      lastRef.current = null
      rerender()
    }, duration)
    return () => clearTimeout(timer)
  }, [leaving, duration])

  const content = present ? children : lastRef.current
  if (!content) return null
  return (
    <div
      className={leaving ? 'presence is-leaving' : 'presence'}
      aria-hidden={leaving ? true : undefined}
      inert={leaving ? '' : undefined}
    >
      {content}
    </div>
  )
}
