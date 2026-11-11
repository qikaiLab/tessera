import { useRef } from 'react'
import { useModalA11y, useOverlayDismiss } from '../utils/useModalA11y'

/**
 * The dimmed overlay and dialog box every ordinary dialog uses (render it inside <Presence> when it
 * should animate out). It gives the box its role and label, moves focus into it, keeps Tab inside,
 * dismisses on Esc and on a click on the overlay, and puts focus back when it closes.
 *
 *   onDismiss   Esc and overlay click; leave it out (or pass a no-op while busy) when the dialog
 *               must be answered
 *   role        'alertdialog' for a question that needs an answer
 *   label       the dialog's name for screen readers
 *   className   the box's classes ('modal' by default)
 *
 * Mark the control that should have focus first with `data-autofocus`.
 */
export default function ModalFrame({ onDismiss, label, role = 'dialog', className = 'modal', style, children, ...rest }) {
  const boxRef = useRef(null)
  useModalA11y(boxRef, { onDismiss })
  const overlayProps = useOverlayDismiss(onDismiss)

  return (
    <div className="modal-overlay" {...overlayProps}>
      <div ref={boxRef} className={className} style={style} role={role} aria-modal="true" aria-label={label} tabIndex={-1} {...rest}>
        {children}
      </div>
    </div>
  )
}
