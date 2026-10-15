import { useCallback, useState } from 'react'
import { useFullscreenPresence } from '../../utils/useFullscreenPresence'

// Which note's editor is fullscreen. `show` stays true while the exit animation plays.
export function useNoteFullscreen() {
  const [fullScreenNoteId, setFullScreenNoteId] = useState(null)
  const { show, leaving } = useFullscreenPresence(Boolean(fullScreenNoteId))
  const toggle = useCallback((noteId) => setFullScreenNoteId(current => (current === noteId ? null : noteId)), [])
  const close = useCallback(() => setFullScreenNoteId(null), [])
  return { show, leaving, toggle, close }
}
