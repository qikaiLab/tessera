import { describe, expect, it } from 'vitest'
import { createNoteOperationBarrier } from '../src/renderer/src/utils/noteOperations.js'

describe('selection immediately after deleting a note', () => {
  it('keeps the clicked selection after the delayed delete callback chooses a fallback', async () => {
    const barrier = createNoteOperationBarrier()
    let finishDelete
    let selected = 'deleted'
    const deletion = barrier.run(async () => {
      await new Promise(resolve => { finishDelete = resolve })
      selected = 'fallback'
    })
    await Promise.resolve()
    expect(barrier.busy()).toBe(true)
    const selection = barrier.wait().then(() => { selected = 'clicked plans' })
    finishDelete()
    await Promise.all([deletion, selection])
    expect(selected).toBe('clicked plans')
    expect(barrier.busy()).toBe(false)
  })

  it('releases blocked selections after a failure and serializes subsequent deletion', async () => {
    const barrier = createNoteOperationBarrier()
    await expect(barrier.run(async () => { throw new Error('disk failed') })).rejects.toThrow('disk failed')
    await barrier.wait()
    expect(barrier.busy()).toBe(false)
    await expect(barrier.run(async () => 'next deletion')).resolves.toBe('next deletion')
  })
})
