// Runs `action` and wraps its outcome the way the renderer expects every IPC result:
// { ok: true, ...whatever action returned } or { ok: false, error }.
export async function attempt(action) {
  try {
    return { ok: true, ...await action() }
  } catch (error) {
    // `code` (ENOENT, EBUSY...) lets the renderer tell a missing file from one that could not be read.
    return { ok: false, error: error.message, code: error.code }
  }
}
