// Links to files and folders on this computer. They are stored as `file:///C:/folder/name.jpg`
// URLs, so spaces and brackets in a path need no special care, and shown to the user as a plain
// Windows path. Only absolute drive paths qualify: a network share would make Windows send the
// user's credentials to its server, and a relative path has no meaning in a note. The main
// process checks the path again before it opens anything (see src/main/localFiles.js).

const DRIVE_PATH = /^([A-Za-z]):[\\/](.*)$/s
const FILE_URL = /^file:\/\/\/([A-Za-z]):\/(.*)$/is
// Characters Windows does not allow in a name, plus control characters.
const FORBIDDEN_CHARS = /[<>"|?*\u0000-\u001f]/

// The folders and file name of a path tail, or null when it holds something unsafe.
function cleanSegments(tail) {
  const segments = tail.split(/[\\/]+/).filter(Boolean)
  if (segments.some(segment => segment === '.' || segment === '..' || segment.includes(':'))) return null
  if (segments.some(segment => FORBIDDEN_CHARS.test(segment))) return null
  return segments
}

/** `C:\Photos\a b.jpg` (or with forward slashes) as a `file:///` URL, or null if it is not a drive path. */
export function localPathToFileUrl(input) {
  const match = DRIVE_PATH.exec(String(input ?? '').trim())
  if (!match) return null
  const segments = cleanSegments(match[2])
  if (!segments) return null
  return `file:///${match[1].toUpperCase()}:/${segments.map(encodeURIComponent).join('/')}`
}

/** The Windows path a `file:///` URL stands for, or null when it is not a local drive path. */
export function fileUrlToLocalPath(href) {
  const match = FILE_URL.exec(String(href ?? '').trim())
  if (!match) return null
  let segments
  try {
    segments = match[2].split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return null
  }
  // An encoded separator ("%2F") would smuggle a folder change past the checks above.
  if (segments.some(segment => /[\\/]/.test(segment))) return null
  const clean = cleanSegments(segments.join('\\'))
  if (!clean) return null
  return `${match[1].toUpperCase()}:\\${clean.join('\\')}`
}

export function isLocalFileHref(href) {
  return fileUrlToLocalPath(href) !== null
}

/** The name to show for a local path: its last segment, or the drive for a drive root. */
export function localPathLabel(localPath) {
  const parts = String(localPath ?? '').split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] || String(localPath ?? '')
}
