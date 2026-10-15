import { useEffect, useLayoutEffect, useRef } from 'react'

const ACTIVE_SELECTOR = '.active, [aria-checked="true"], [aria-selected="true"]'

function placeThumb(el) {
  const active = el.querySelector(ACTIVE_SELECTOR)
  if (!active) {
    el.classList.remove('has-thumb')
    return
  }
  const { style } = el
  style.setProperty('--thumb-x', `${active.offsetLeft}px`)
  style.setProperty('--thumb-y', `${active.offsetTop}px`)
  style.setProperty('--thumb-w', `${active.offsetWidth}px`)
  style.setProperty('--thumb-h', `${active.offsetHeight}px`)
  el.classList.add('has-thumb')
}

/**
 * Lets the highlight of a segmented control / tab strip slide to the newly selected button
 * instead of jumping. It measures the active child and publishes its box as CSS variables
 * (--thumb-x/y/w/h); the `.has-thumb::before` rule in styles/tabs.css draws and animates it.
 * Attach the returned ref to the container (which may mount later than the component).
 */
export function useSlidingThumb() {
  const ref = useRef(null)
  const watched = useRef({ el: null, observer: null, frame: 0 })

  // Runs after every commit: the selection changed, or the container just appeared.
  useLayoutEffect(() => {
    const el = ref.current
    const state = watched.current
    if (el !== state.el) {
      state.observer?.disconnect()
      cancelAnimationFrame(state.frame)
      state.el = el
      state.observer = null
      if (el) {
        // Slide only after the first placement, so the control does not fly in from a corner.
        state.frame = requestAnimationFrame(() => el.classList.add('thumb-ready'))
        if (typeof ResizeObserver !== 'undefined') {
          state.observer = new ResizeObserver(() => placeThumb(el))
          state.observer.observe(el)
        }
      }
    }
    if (el) placeThumb(el)
  })

  useEffect(() => () => {
    const state = watched.current
    state.observer?.disconnect()
    cancelAnimationFrame(state.frame)
  }, [])

  return ref
}
