import { useEffect } from 'react'

// Matches the slotGrow animation in SectionCard.css.
const ADD_SECTION_MS = 460
// Time constant of the follow-scroll easing: smaller is snappier.
const SCROLL_FOLLOW_MS = 120

/**
 * Glides the page to a section that was just added and keeps it in view while it grows. Every
 * frame eases the scroll position a fraction of the way to where the card should be (its
 * centre, or its top for a tall card), so the motion is smooth, adapts as the card changes size,
 * and stops the moment the user takes over with the wheel or keyboard. `onDone` is called when
 * the motion ends (or is cancelled).
 */
export function useFollowAddedSection(contentRef, addedSectionId, onDone) {
  useEffect(() => {
    if (!addedSectionId) return undefined
    const container = contentRef.current
    const slot = container?.querySelector(`[data-section-slot="${CSS.escape(addedSectionId)}"]`)
    if (!container || !slot) return undefined

    let frame = 0
    let cancelled = false
    const started = performance.now()
    let previous = started
    const finish = () => onDone(addedSectionId)
    const cancel = () => { cancelled = true; finish() }
    container.addEventListener('wheel', cancel, { passive: true, once: true })
    container.addEventListener('touchstart', cancel, { passive: true, once: true })
    window.addEventListener('keydown', cancel, { once: true })

    const step = (now) => {
      if (cancelled) return
      const elapsed = now - started
      const box = slot.getBoundingClientRect()
      const view = container.getBoundingClientRect()
      const toCentre = box.top + box.height / 2 - (view.top + view.height / 2)
      const toTop = box.top - (view.top + 24)
      const distance = Math.min(toCentre, toTop)
      container.scrollTop += distance * (1 - Math.exp(-Math.min(48, now - previous) / SCROLL_FOLLOW_MS))
      previous = now
      if (elapsed < ADD_SECTION_MS + 120 || (Math.abs(distance) > 1.5 && elapsed < ADD_SECTION_MS + 1200)) {
        frame = requestAnimationFrame(step)
      } else {
        finish()
      }
    }
    frame = requestAnimationFrame(step)
    // Safety net: a hidden window never runs animation frames.
    const safety = setTimeout(finish, ADD_SECTION_MS + 1800)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(safety)
      container.removeEventListener('wheel', cancel)
      container.removeEventListener('touchstart', cancel)
      window.removeEventListener('keydown', cancel)
    }
  }, [contentRef, addedSectionId, onDone])
}
