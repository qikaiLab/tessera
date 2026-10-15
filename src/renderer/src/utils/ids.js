/** A short unique id for records created in the app (sections, chart cards). */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

/** A UUID where the platform has one (note ids become file names), else a short id. */
export function generateUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return generateId()
}
