export async function flushSaveCallbacks(callbacks) {
  const results = await Promise.all([...callbacks].map(flush =>
    Promise.resolve().then(flush).catch(() => false)
  ))
  return results.every(result => result !== false && result?.ok !== false)
}

export async function flushPendingValue(reference, write) {
  const value = reference.current
  if (value === null) return { ok: true }
  try {
    const result = await write(value)
    if (result.ok && reference.current === value) reference.current = null
    return result
  } catch (error) { return { ok: false, error: error.message } }
}
