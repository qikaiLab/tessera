import { useCallback, useState } from 'react'

// How long a toast keeps fading out after its time is up (matches the CSS).
const TOAST_LEAVE_MS = 220

export function useToasts() {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, leaving: false }])
    setTimeout(() => {
      setToasts(prev => prev.map(toast => (toast.id === id ? { ...toast, leaving: true } : toast)))
    }, duration)
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, duration + TOAST_LEAVE_MS)
  }, [])

  return { toasts, showToast }
}
