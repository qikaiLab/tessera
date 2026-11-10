import path from 'node:path'

// Export and import read and write files outside the data directory. The renderer names the path,
// so the main process only accepts one the user has just picked in a native dialog: a page that
// went wrong could otherwise overwrite or read any file the user can. A grant is good for one use.

const MAX_GRANTS = 50

export function createPathGrants({ platform = process.platform } = {}) {
  const granted = new Set()
  const keyOf = (kind, target) => {
    const resolved = path.resolve(target)
    return `${kind}:${platform === 'win32' ? resolved.toLowerCase() : resolved}`
  }

  return {
    grant(kind, target) {
      if (typeof target !== 'string' || !target) return
      granted.add(keyOf(kind, target))
      // Old, never-used picks (a dialog answered but the action abandoned) do not pile up.
      while (granted.size > MAX_GRANTS) granted.delete(granted.values().next().value)
    },
    // Was this path granted for `kind`? (does not use the grant up)
    has(kind, target) {
      return typeof target === 'string' && target !== '' && granted.has(keyOf(kind, target))
    },
    // True once for a path that was granted for `kind` ('read', 'write' or 'folder').
    consume(kind, target) {
      if (typeof target !== 'string' || !target) return false
      return granted.delete(keyOf(kind, target))
    }
  }
}

export const pathGrants = createPathGrants()
