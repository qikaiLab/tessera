import { useEffect, useState } from 'react'

/**
 * True only once `active` has been continuously true for `delay` ms. Used to show a loading
 * skeleton only when loading is actually slow: a fast load then goes straight to the content
 * instead of flashing a placeholder for a few frames.
 */
export function useDelayedFlag(active, delay = 220) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!active) {
      setReady(false)
      return undefined
    }
    const timer = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(timer)
  }, [active, delay])
  return active && ready
}
