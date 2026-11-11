import { describe, expect, it, vi } from 'vitest'
import { adoptLeftovers, handOverPendingWrite, markWritten } from '../src/renderer/src/utils/leftoverSaves.js'

function registry() {
  const flushes = new Map()
  return {
    flushes,
    registerPendingFlush: (key, fn) => flushes.set(key, fn),
    unregisterPendingFlush: (key) => flushes.delete(key)
  }
}

describe('leftover saves', () => {
  it('writes at once and leaves nothing registered after success', async () => {
    const reg = registry()
    const write = vi.fn(async () => ({ ok: true }))
    const result = await handOverPendingWrite({ key: 'day:ok', write, ...reg })
    expect(result.ok).toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    expect(reg.flushes.size).toBe(0)
  })

  it('stays registered with the shutdown flush after a failure and is retried there', async () => {
    const reg = registry()
    const onFailure = vi.fn()
    let failing = true
    const write = vi.fn(async () => (failing ? { ok: false } : { ok: true }))
    const first = await handOverPendingWrite({ key: 'day:retry', write, onFailure, ...reg })
    expect(first.ok).toBe(false)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(reg.flushes.has('day:retry#leftover')).toBe(true)

    failing = false
    const retried = await reg.flushes.get('day:retry#leftover')()
    expect(retried.ok).toBe(true)
    expect(write).toHaveBeenCalledTimes(2)
    expect(reg.flushes.size).toBe(0)
  })

  it('turns a throwing write into a failed result that is kept for retry', async () => {
    const reg = registry()
    const result = await handOverPendingWrite({
      key: 'day:throws',
      write: async () => { throw new Error('disk full') },
      ...reg
    })
    expect(result).toMatchObject({ ok: false, error: 'disk full' })
    expect(reg.flushes.has('day:throws#leftover')).toBe(true)
  })

  it('never puts an older copy back over content written after it', async () => {
    const reg = registry()
    const write = vi.fn(async () => ({ ok: false }))
    await handOverPendingWrite({ key: 'day:stale', write, ...reg })
    expect(write).toHaveBeenCalledTimes(1)

    markWritten('day:stale') // the page was opened again and newer content reached the file
    const retried = await reg.flushes.get('day:stale#leftover')()
    expect(retried).toEqual({ ok: true, superseded: true })
    expect(write).toHaveBeenCalledTimes(1)
    expect(reg.flushes.size).toBe(0)
  })

  it('a write that happened before the hand-over does not cancel it', async () => {
    const reg = registry()
    markWritten('day:before')
    const write = vi.fn(async () => ({ ok: true }))
    await handOverPendingWrite({ key: 'day:before', write, ...reg })
    expect(write).toHaveBeenCalledTimes(1)
  })
})

describe('a page that opens the day or note again', () => {
  it('starts from a failed hand-over instead of the older file, and its own later write replaces it', async () => {
    const reg = registry()
    const write = vi.fn(async () => ({ ok: false }))
    await handOverPendingWrite({ key: 'day:adopt', value: { text: 'unsaved edit' }, write, ...reg })

    const adopted = await adoptLeftovers('day:adopt')
    expect(adopted).toEqual([{ key: 'day:adopt', value: { text: 'unsaved edit' } }])
    // The page shows that copy; until it writes, closing still retries the copy.
    expect(reg.flushes.has('day:adopt#leftover')).toBe(true)

    // The page saved on top of it (the copy was in its content): the old copy must not be written again.
    markWritten('day:adopt')
    expect(await reg.flushes.get('day:adopt#leftover')()).toEqual({ ok: true, superseded: true })
    expect(write).toHaveBeenCalledTimes(1)
    expect(reg.flushes.size).toBe(0)
    expect(await adoptLeftovers('day:adopt')).toEqual([])
  })

  it('without a write by the page, the adopted copy is still retried at close', async () => {
    const reg = registry()
    let failing = true
    const write = vi.fn(async () => (failing ? { ok: false } : { ok: true }))
    await handOverPendingWrite({ key: 'day:keep', value: 'v', write, ...reg })
    await adoptLeftovers('day:keep')
    failing = false
    expect((await reg.flushes.get('day:keep#leftover')()).ok).toBe(true)
    expect(write).toHaveBeenCalledTimes(2)
    expect(reg.flushes.size).toBe(0)
  })

  it('waits for a hand-over that is still being written and then finds nothing to restore', async () => {
    const reg = registry()
    let finish
    const write = () => new Promise(resolve => { finish = () => resolve({ ok: true }) })
    const handed = handOverPendingWrite({ key: 'day:slow', value: 'v', write, ...reg })
    let opened = false
    const opening = adoptLeftovers('day:slow').then(result => { opened = true; return result })
    await Promise.resolve()
    expect(opened).toBe(false) // the page would otherwise read the file before the edit reached it
    finish()
    await handed
    expect(await opening).toEqual([])
  })

  it('matches by prefix, so every unsaved note is found at once', async () => {
    const reg = registry()
    const fail = async () => ({ ok: false })
    await handOverPendingWrite({ key: 'note:a', value: 'A', write: fail, ...reg })
    await handOverPendingWrite({ key: 'note:b', value: 'B', write: fail, ...reg })
    await handOverPendingWrite({ key: 'day:2026-01-01', value: 'D', write: fail, ...reg })
    const adopted = await adoptLeftovers('note:')
    expect(adopted.map(item => item.key).sort()).toEqual(['note:a', 'note:b'])
  })

  it('does not take the hand-over own writes (a note saved, its index not) for newer content', async () => {
    const reg = registry()
    let indexFails = true
    const write = vi.fn(async () => {
      markWritten('note:own') // the note file went through
      return indexFails ? { ok: false } : { ok: true }
    })
    await handOverPendingWrite({ key: 'note:own', value: 'N', write, ...reg })
    expect(reg.flushes.has('note:own#leftover')).toBe(true)
    indexFails = false
    const retried = await reg.flushes.get('note:own#leftover')()
    expect(retried).toEqual({ ok: true })
    expect(write).toHaveBeenCalledTimes(2)
    expect(reg.flushes.size).toBe(0)
  })

  it('a newer hand-over of the same key takes over the registration', async () => {
    const reg = registry()
    const fail = async () => ({ ok: false })
    await handOverPendingWrite({ key: 'day:twice', value: 'first', write: fail, ...reg })
    const secondWrite = vi.fn(async () => ({ ok: true }))
    await handOverPendingWrite({ key: 'day:twice', value: 'second', write: secondWrite, ...reg })
    expect(reg.flushes.size).toBe(0)
    expect(await adoptLeftovers('day:twice')).toEqual([])
  })
})
