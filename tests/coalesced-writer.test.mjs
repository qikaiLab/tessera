import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCoalescedWriter } from '../src/renderer/src/utils/coalescedWriter.js'

// A write that stays "in flight" until the test lets it finish.
function controlledWrite(read) {
  const reads = []
  const resolvers = []
  const write = () => {
    reads.push(read())
    return new Promise((resolve) => resolvers.push(resolve))
  }
  return { write, reads, finish: (result = { ok: true }) => resolvers.shift()(result) }
}

describe('coalesced writer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('collects quick edits into one write of the latest state', async () => {
    let state = 0
    const writes = []
    const writer = createCoalescedWriter({
      write: async () => { writes.push(state); return { ok: true } },
      debounceMs: 100
    })
    state = 1; writer.markDirty()
    state = 2; writer.markDirty()
    await vi.advanceTimersByTimeAsync(99)
    expect(writes).toEqual([])
    await vi.advanceTimersByTimeAsync(2)
    expect(writes).toEqual([2])
    expect(writer.isDirty()).toBe(false)
  })

  it('writes an edit made during a write afterwards instead of forgetting it', async () => {
    let state = 1
    const io = controlledWrite(() => state)
    const writer = createCoalescedWriter({ write: io.write, debounceMs: 10, rewriteMs: 20 })
    writer.markDirty()
    await vi.advanceTimersByTimeAsync(10)
    expect(io.reads).toEqual([1])

    state = 2
    writer.markDirty()
    await vi.advanceTimersByTimeAsync(10) // the debounce fires while the first write is still running
    expect(io.reads).toEqual([1]) // never two writes at once
    expect(writer.isDirty()).toBe(true)

    io.finish()
    await vi.advanceTimersByTimeAsync(20)
    expect(io.reads).toEqual([1, 2])
    io.finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(writer.isDirty()).toBe(false)
  })

  it('keeps retrying a failed write and reports once it works again', async () => {
    let failing = true
    let calls = 0
    const onFailure = vi.fn()
    const onSuccess = vi.fn()
    const writer = createCoalescedWriter({
      write: async () => { calls++; return failing ? { ok: false } : { ok: true } },
      debounceMs: 10, retryMs: 1000, onFailure, onSuccess
    })
    writer.markDirty()
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toBe(1)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(writer.isDirty()).toBe(true)

    await vi.advanceTimersByTimeAsync(999)
    expect(calls).toBe(1)
    failing = false
    await vi.advanceTimersByTimeAsync(2)
    expect(calls).toBe(2)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(writer.isDirty()).toBe(false)
  })

  it('treats a write that throws as a failure', async () => {
    const onFailure = vi.fn()
    const writer = createCoalescedWriter({
      write: async () => { throw new Error('disk full') },
      debounceMs: 10, retryMs: 1000, onFailure
    })
    writer.markDirty()
    await vi.advanceTimersByTimeAsync(10)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(writer.isDirty()).toBe(true)
  })

  it('flush writes what is pending right away and answers true', async () => {
    let state = 5
    const writes = []
    const writer = createCoalescedWriter({
      write: async () => { writes.push(state); return { ok: true } },
      debounceMs: 10000
    })
    writer.markDirty()
    expect(await writer.flush()).toBe(true)
    expect(writes).toEqual([5])
    // Nothing pending: nothing written, still fine to close.
    expect(await writer.flush()).toBe(true)
    expect(writes).toEqual([5])
  })

  it('flush answers false while the file cannot be brought up to date', async () => {
    const writer = createCoalescedWriter({
      write: async () => ({ ok: false }),
      debounceMs: 10000, retryMs: 1000
    })
    writer.markDirty()
    expect(await writer.flush()).toBe(false)
    expect(writer.isDirty()).toBe(true)
  })

  it('flush waits for the write in flight and then writes the newer state', async () => {
    let state = 1
    const io = controlledWrite(() => state)
    const writer = createCoalescedWriter({ write: io.write, debounceMs: 10, rewriteMs: 20 })
    writer.markDirty()
    await vi.advanceTimersByTimeAsync(10)
    state = 2
    writer.markDirty()

    const flushing = writer.flush()
    io.finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(io.reads).toEqual([1, 2])
    io.finish()
    expect(await flushing).toBe(true)
    expect(writer.isDirty()).toBe(false)
  })
})
