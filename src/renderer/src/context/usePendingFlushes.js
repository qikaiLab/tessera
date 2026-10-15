import { useCallback, useEffect, useRef } from 'react'
import { flushSaveCallbacks } from '../utils/pendingSaves'

/**
 * A registry of "write what you still hold" callbacks, one per part of the app with unsaved
 * edits (the day's records, notes, metadata). Closing the window flushes them all first; if
 * any fails, the close is cancelled so nothing is lost.
 */
export function usePendingFlushes({ showToast }) {
  const flushesRef = useRef(new Map())

  const registerPendingFlush = useCallback((key, flushFn) => {
    flushesRef.current.set(key, flushFn)
  }, [])

  const unregisterPendingFlush = useCallback((key) => {
    flushesRef.current.delete(key)
  }, [])

  const flushPendingSaves = useCallback(() => flushSaveCallbacks(flushesRef.current.values()), [])

  useEffect(() => {
    return window.api.lifecycle.onBeforeClose(async () => {
      if (!await flushPendingSaves()) {
        await window.api.lifecycle.cancelClose()
        showToast('保存失败，已取消退出。请重试保存，或先复制未保存的内容。', 'error')
        return
      }
      // Tell the main process it is safe to close now.
      window.api.lifecycle.confirmClose()
    })
  }, [flushPendingSaves, showToast])

  return { registerPendingFlush, unregisterPendingFlush, flushPendingSaves }
}
