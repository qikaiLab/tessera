import { useEffect, useState } from 'react'

/**
 * Keeps a fullscreen layer (and the page's "a fullscreen editor is open" styling) alive for
 * `duration` ms after fullscreen is switched off, so its exit animation can play over the
 * page that has already returned to normal.
 *
 * Returns `show` (render fullscreen: true while active or leaving) and `leaving`.
 */
export function useFullscreenPresence(active, duration = 240) {
  const [state, setState] = useState({ previous: active, leaving: false })
  // Derived during render, so the very first frame after switching off already knows it is
  // leaving and never renders the page without the overlay.
  if (state.previous !== active) setState({ previous: active, leaving: state.previous && !active })
  const leaving = state.leaving && !active

  useEffect(() => {
    if (!leaving) return undefined
    const timer = setTimeout(() => setState(current => ({ ...current, leaving: false })), duration)
    return () => clearTimeout(timer)
  }, [leaving, duration])

  return { show: active || leaving, leaving }
}
