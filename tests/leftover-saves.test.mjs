import { describe, expect, it, vi } from 'vitest'
import { handOverPendingWrite, markWritten } from '../src/renderer/src/utils/leftoverSaves.js'

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
