/**
 * Writing one file that changes often: edits are collected for `debounceMs`, only one write is in
 * flight at a time, and anything that changed while a write was running (or whose write failed) is
 * written again afterwards. `write()` must read the *current* state when it is called and answer
 * { ok } (or throw). "Dirty" means "the file is behind the state"; it is only cleared by the write
 * that actually takes the state, so no edit can be forgotten because it arrived mid-write.
 *
 * `flush()` is for shutdown: it waits for the write in flight and writes what is still pending,
 * answering false when the file could not be brought up to date.
 */
export function createCoalescedWriter({
  write, debounceMs = 300, rewriteMs = 50, retryMs = 3000, onFailure, onSuccess
}) {
  let dirty = false
  let writing = null
  let debounceTimer = null
  let followUpTimer = null

  const clear = (timer) => { if (timer) clearTimeout(timer) }

  async function run() {
    if (writing) return writing
    clear(followUpTimer)
    followUpTimer = null
    dirty = false
    writing = (async () => {
      try {
        const result = await write()
        return result?.ok !== false
      } catch {
        return false
      }
    })()
    const ok = await writing
    writing = null
    if (ok) {
      onSuccess?.()
    } else {
      dirty = true
      onFailure?.()
    }
    if (dirty) {
      // Changed during the write, or the write failed: the file is still behind.
      followUpTimer = setTimeout(() => { followUpTimer = null; run() }, ok ? rewriteMs : retryMs)
    }
    return ok
  }

  return {
    markDirty() {
      dirty = true
      clear(debounceTimer)
      debounceTimer = setTimeout(() => { debounceTimer = null; run() }, debounceMs)
    },
    async flush() {
      clear(debounceTimer)
      debounceTimer = null
      clear(followUpTimer)
      followUpTimer = null
      if (writing) await writing
      while (dirty) {
        if (!await run()) return false
      }
      return true
    },
    isDirty: () => dirty
  }
}
