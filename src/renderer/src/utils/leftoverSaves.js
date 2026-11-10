// Writes that were still pending when the part of the app holding them went away (the record page
// or the notes page was left, a note was switched). They are written at once; if that fails they
// stay registered with the app's shutdown flush, so closing the window retries them and is refused
// while they cannot be saved, instead of the edit vanishing with the page.

const lastWrite = new Map()
let counter = 0

// Call after a write of `key` succeeded: a leftover for the same key created earlier is then stale.
export function markWritten(key) {
  lastWrite.set(key, ++counter)
}

export function handOverPendingWrite({ key, write, registerPendingFlush, unregisterPendingFlush, onFailure }) {
  const created = ++counter
  const flushKey = `${key}#leftover`
  const run = async () => {
    // Newer content of the same day / note was written since (the page was opened again and
    // edited): writing this older copy now would put it back.
    if ((lastWrite.get(key) ?? 0) > created) {
      unregisterPendingFlush(flushKey)
      return { ok: true, superseded: true }
    }
    let result
    try {
      result = await write()
    } catch (error) {
      result = { ok: false, error: error.message }
    }
    if (result?.ok) unregisterPendingFlush(flushKey)
    return result
  }
  registerPendingFlush(flushKey, run)
  return run().then(result => {
    if (!result?.ok) onFailure?.(result)
    return result
  })
}
