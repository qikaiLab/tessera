// Writes that were still pending when the part of the app holding them went away (the record page
// or the notes page was left, a note was switched). They are written at once; if that fails they
// stay registered with the app's shutdown flush, so closing the window retries them and is refused
// while they cannot be saved, instead of the edit vanishing with the page.
//
// A page that opens the same day / note again must not start from the (older) file while such a
// write is unfinished: it waits for one that is still running and starts from the copy of one that
// failed (`adoptLeftovers`). Only a write made after the page adopted that copy replaces it.

const lastWrite = new Map()
// Hand-overs that are not on disk yet, by key.
const outstanding = new Map()
let counter = 0

// Call after a write of `key` succeeded: a leftover for the same key created earlier is then stale.
export function markWritten(key) {
  lastWrite.set(key, ++counter)
}

// Newer content of the same day / note was written since this copy was made (or adopted by a page,
// which then wrote on top of it, or by this hand-over's own write): writing the copy now would put
// older content back.
function isSuperseded(key, entry) {
  const since = Math.max(entry.adopted || entry.created, entry.ownWrite)
  return (lastWrite.get(key) ?? 0) > since
}

export function handOverPendingWrite({ key, value, write, registerPendingFlush, unregisterPendingFlush, onFailure }) {
  const entry = { value, created: ++counter, adopted: 0, ownWrite: 0, settled: null, forget: null }
  const flushKey = `${key}#leftover`
  outstanding.set(key, entry)

  const forget = () => {
    // A newer hand-over of the same key has taken over the registration.
    if (outstanding.get(key) !== entry) return
    outstanding.delete(key)
    unregisterPendingFlush(flushKey)
  }
  entry.forget = forget

  const run = async () => {
    if (isSuperseded(key, entry)) {
      forget()
      return { ok: true, superseded: true }
    }
    let result
    try {
      result = await write()
    } catch (error) {
      result = { ok: false, error: error.message }
    }
    // Writes this hand-over made itself (a note file written, its index not) are not "newer content".
    entry.ownWrite = counter
    if (result?.ok) forget()
    return result
  }

  registerPendingFlush(flushKey, run)
  entry.settled = run().then(result => {
    if (!result?.ok) onFailure?.(result)
    return result
  })
  return entry.settled
}

// For a page that opens a day, or the notes (every key starting with `prefix`): waits for hand-overs
// still being written, then returns the copies of those that failed as [{ key, value }]. The copies
// stay registered for the shutdown flush; they stop counting once the page wrote on top of them.
export async function adoptLeftovers(prefix) {
  const entries = [...outstanding.entries()].filter(([key]) => key.startsWith(prefix))
  await Promise.all(entries.map(([, entry]) => entry.settled))
  const adopted = []
  for (const [key, entry] of entries) {
    if (outstanding.get(key) !== entry) continue
    if (isSuperseded(key, entry)) {
      entry.forget()
      continue
    }
    entry.adopted = ++counter
    adopted.push({ key, value: entry.value })
  }
  return adopted
}
