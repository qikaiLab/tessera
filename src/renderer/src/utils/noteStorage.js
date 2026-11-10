import {
  NOTES_INDEX_PATH,
  compareNotes,
  normalizeNoteMeta,
  notePath,
  parseNote
} from './notes'

/**
 * Reads every note from the data directory, ordered for display.
 *
 * The index lists the notes, but each note lives in its own `notes/<id>.json`. A missing or
 * unreadable index must not make existing notes vanish, so the list is then rebuilt from the
 * files themselves. `onIndexCorrupt` is called when an index exists but cannot be used.
 */
export async function loadNotesFromDisk({ onIndexCorrupt } = {}) {
  const indexResult = await window.api.fs.readFile(NOTES_INDEX_PATH)
  let metas = []
  let indexUsable = false
  if (indexResult.ok) {
    try {
      const parsed = JSON.parse(indexResult.data)
      if (!Array.isArray(parsed)) throw new Error('notes index is not a list')
      metas = parsed
      indexUsable = true
    } catch {
      onIndexCorrupt?.()
    }
  }
  // The note files are the notes. A usable index only supplies their order and metadata: a file
  // it does not list (an import of an older index, a recovered temporary file, a crash between the
  // note's write and the index's) is adopted rather than left invisible on disk.
  const listing = await window.api.fs.listDir('notes')
  if (listing.ok) {
    const listed = new Set(indexUsable ? metas.map(meta => meta?.id) : [])
    for (const name of listing.data) {
      if (!name.endsWith('.json') || name === 'index.json') continue
      const id = name.slice(0, -'.json'.length)
      if (!listed.has(id)) metas.push({ id })
    }
  }

  const notes = await Promise.all(metas.map(async meta => {
    const result = await window.api.fs.readFile(notePath(meta.id))
    if (!result.ok) return normalizeNoteMeta(meta)
    return parseNote(result.data, meta) || normalizeNoteMeta(meta)
  }))
  return notes.sort(compareNotes)
}
