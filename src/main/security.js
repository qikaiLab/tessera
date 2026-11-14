const path = require('path')

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

// What Windows reads differently from what is written: the device names (CON, NUL, COM1 ... with or
// without an extension) are not files at all, a colon names an alternate data stream (or a drive),
// and a trailing dot or space is silently dropped. None of them is ever a name the app creates.
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i
const UNSUPPORTED_NAME_CHARS = /[<>:"|?*\u0000-\u001f]/

function hasUnsupportedName(segment) {
  return UNSUPPORTED_NAME_CHARS.test(segment) || WINDOWS_DEVICE_NAME.test(segment) || /[. ]$/.test(segment)
}

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
  // The directory itself is not a file: writing "a/.." would put its temporary file beside the
  // data directory instead of inside it.
  if (relative === '') {
    throw new Error('Path must name a file inside the data directory')
  }
  if (relative.split(path.sep).some(hasUnsupportedName)) {
    throw new Error('Unsupported file name')
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

// In a packaged app the window may only stay on (or reload) its own index page. A link to some
// other local file must never replace the app with it.
function isAppIndexUrl(url, appIndexUrl) {
  try {
    const target = new URL(url)
    const index = new URL(appIndexUrl)
    return target.protocol === 'file:' &&
      decodeURIComponent(target.pathname).toLowerCase() === decodeURIComponent(index.pathname).toLowerCase()
  } catch {
    return false
  }
}

function isAppNavigationUrl(url, { isDev, rendererUrl, appIndexUrl } = {}) {
  if (!url) return false
  if (!isDev) return appIndexUrl ? isAppIndexUrl(url, appIndexUrl) : url.startsWith('file:')

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
