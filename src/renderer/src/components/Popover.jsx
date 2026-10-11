import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import './Popover.css'

/**
 * A floating panel anchored to a trigger. Closes on outside click or Escape.
 *
 * trigger:  ({ ref, props, open }) => element — spread `props` and attach `ref`.
 * children: ({ close }) => panel content.
 */
export default function Popover({ trigger, children, label, placement = 'bottom-start', className = '' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return undefined
    const reference = triggerRef.current
    const floating = panelRef.current
    const update = () => computePosition(reference, floating, {
      strategy: 'fixed',
      placement,
      middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })]
    }).then(({ x, y }) => {
      Object.assign(floating.style, { left: `${x}px`, top: `${y}px` })
    })
    return autoUpdate(reference, floating, update)
  }, [open, placement])

  useEffect(() => {
    if (!open) return undefined
    panelRef.current?.focus({ preventScroll: true })
    const handlePointerDown = (event) => {
      if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return
      close(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, close])

  const triggerProps = {
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
    onClick: () => (open ? close(false) : setOpen(true))
  }

  return (
    <>
      {trigger({ ref: triggerRef, props: triggerProps, open })}
      {open && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={`dropdown-menu popover-panel ${className}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          {children({ close })}
        </div>,
        document.body
      )}
    </>
  )
}
