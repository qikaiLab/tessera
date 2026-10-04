// A click immediately after confirming deletion must apply after its disk commit.
export function createNoteOperationBarrier() {
  let pending = Promise.resolve()
  let count = 0
  return {
    busy: () => count > 0,
    wait: () => pending,
    run(operation) {
      count++
      const result = pending.then(operation)
      pending = result.catch(() => {}).finally(() => { count-- })
      return pending.then(() => result)
    }
  }
}
