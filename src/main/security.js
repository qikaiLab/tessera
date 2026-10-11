const path = require('path')

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

function resolveSafePath(baseDir, filePath) {
  if (typeof baseDir !== 'string' || baseDir.length === 0) {
    throw new Error('Data directory is not configured')
  }
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('File path is required')
  }
  if (path.isAbsolute(filePath)) {
    throw new Error('Absolute paths are not allowed')
  }

  const normalizedBaseDir = path.resolve(baseDir)
  const resolved = path.resolve(normalizedBaseDir, filePath)
  const relative = path.relative(normalizedBaseDir, resolved)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

function isAllowedExternalUrl(url) {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

function isAppNavigationUrl(url, { isDev, rendererUrl } = {}) {
  if (!url) return false
  if (!isDev) return url.startsWith('file:')

  try {
    return new URL(url).origin === new URL(rendererUrl).origin
  } catch {
    return false
  }
}

// True when `target` is `parent` itself or lives somewhere inside it.
function isPathInside(parent, target) {
  if (typeof parent !== 'string' || typeof target !== 'string' || !parent || !target) return false
  const relative = path.relative(path.resolve(parent), path.resolve(target))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export {
  isPathInside,
  resolveSafePath,
  isAllowedExternalUrl,
  isAppNavigationUrl
}
