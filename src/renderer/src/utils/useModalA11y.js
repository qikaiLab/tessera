import { useCallback, useEffect, useRef } from 'react'

// Keyboard behaviour every dialog shares: focus moves into it when it opens and goes back to
// where it came from when it closes, Tab stays inside, and Esc dismisses it (unless it cannot be
// dismissed right now). With several dialogs open (a confirmation on top of the history window)
// only the newest answers the keyboard.

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

// Dialogs that are open, oldest first.
const openDialogs = []

// A dialog that is playing its closing animation sits inside an `inert` wrapper: it is gone as far
// as the keyboard is concerned.
const isLive = (dialog) => !dialog.container.closest('[inert]')

function topDialog() {
  for (let i = openDialogs.length - 1; i >= 0; i -= 1) {
    if (isLive(openDialogs[i])) return openDialogs[i]
  }
  return null
}

function focusableIn(container) {
  return [...container.querySelectorAll(FOCUSABLE)]
    .filter(element => !element.closest('[inert]') && element.getClientRects().length > 0)
}

/**
 * Attach to the element that is the dialog itself (the box, not the dimmed overlay).
 *
 *   onDismiss       called for Esc; leave it out for a dialog that must be answered
 *   initialFocus    false when the dialog places focus itself
 *
 * Focus goes to the element marked `data-autofocus` inside it, else to the dialog (give it
 * tabIndex={-1}), so a screen reader announces it and Tab continues from its first control.
 */
export function useModalA11y(containerRef, { onDismiss, initialFocus = true } = {}) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const dialog = { container }
    openDialogs.push(dialog)
    const opener = document.activeElement

    if (initialFocus) {
      const target = container.querySelector('[data-autofocus]') || container
      target.focus({ preventScroll: true })
    }

    const onKeyDown = (event) => {
      if (topDialog() !== dialog) return

      if (event.key === 'Escape') {
        // Esc that ends an input-method composition is not meant for the dialog.
        if (event.isComposing || event.keyCode === 229) return
        // Whatever the dialog does with it, nothing underneath (a fullscreen editor, the history
        // window behind a confirmation) gets it as well.
        event.preventDefault()
        event.stopPropagation()
        dismissRef.current?.()
        return
      }

      if (event.key !== 'Tab') return
      const items = focusableIn(container)
      if (!items.length) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }
      const active = document.activeElement
      if (!container.contains(active)) {
        event.preventDefault()
        items[0].focus()
      } else if (event.shiftKey && (active === items[0] || active === container)) {
        event.preventDefault()
        items[items.length - 1].focus()
      } else if (!event.shiftKey && active === items[items.length - 1]) {
        event.preventDefault()
        items[0].focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const index = openDialogs.indexOf(dialog)
      if (index >= 0) openDialogs.splice(index, 1)
      // Back to where the user was, unless they have already gone somewhere else.
      const active = document.activeElement
      if (opener instanceof HTMLElement && opener.isConnected && (!active || active === document.body)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [containerRef, initialFocus])
}

/**
 * Props for a dimmed overlay that closes its dialog when it is clicked. A click only counts when
 * it both started and ended on the overlay itself: pressing inside a text field, dragging a
 * selection out past the dialog's edge and letting go over the overlay is not a click on it.
 */
export function useOverlayDismiss(onDismiss) {
  const pressedOnOverlay = useRef(false)
  const onMouseDown = useCallback((event) => {
    pressedOnOverlay.current = event.target === event.currentTarget
  }, [])
  const onClick = useCallback((event) => {
    const counts = event.target === event.currentTarget && pressedOnOverlay.current
    pressedOnOverlay.current = false
    if (counts) onDismiss?.()
  }, [onDismiss])
  return { onMouseDown, onClick }
}
