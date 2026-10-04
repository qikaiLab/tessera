import { describe, expect, it } from 'vitest'
import { flushSaveCallbacks, flushPendingValue } from '../src/renderer/src/utils/pendingSaves.js'

describe('safe shutdown and restoration', () => {
  it('refuses to proceed after false, failed IPC responses or exceptions', async () => {
    expect(await flushSaveCallbacks([async () => true, async () => false])).toBe(false)
    expect(await flushSaveCallbacks([async () => ({ ok: false })])).toBe(false)
    expect(await flushSaveCallbacks([async () => { throw new Error('disk full') }])).toBe(false)
  })
  it('waits for every save before permitting shutdown', async () => {
    let resolveSave
    let completed = false
    const flushing = flushSaveCallbacks([() => new Promise(resolve => { resolveSave = resolve })])
      .then(result => { completed = true; return result })
    await Promise.resolve()
    expect(completed).toBe(false)
    resolveSave({ ok: true })
    expect(await flushing).toBe(true)
  })
  it('retains failed day edits for retry, date switching and close checks', async () => {
    const reference = { current: { journal: 'unsaved text' } }
    const value = reference.current
    expect(await flushPendingValue(reference, async () => ({ ok: false }))).toEqual({ ok: false })
    expect(reference.current).toBe(value)
    expect(await flushPendingValue(reference, async () => { throw new Error('disk full') })).toMatchObject({ ok: false })
    expect(reference.current).toBe(value)
    await flushPendingValue(reference, async () => ({ ok: true }))
    expect(reference.current).toBeNull()
  })
  it('does not clear newer edits when an older in-flight day save completes', async () => {
    const reference = { current: { journal: 'old edit' } }
    let finish
    const saving = flushPendingValue(reference, () => new Promise(resolve => { finish = resolve }))
    const latest = { journal: 'new edit' }
    reference.current = latest
    finish({ ok: true })
    await saving
    expect(reference.current).toBe(latest)
  })
})
