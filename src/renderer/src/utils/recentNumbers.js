import { hasStoredValue, storedText } from './dayEntries'

// How many earlier days are read at once while looking for a number to carry over.
const CHUNK_SIZE = 24

/**
 * The latest number recorded before `before` for each of `sectionIds` (number sections that carry
 * their value from day to day). Earlier days are read newest first, a chunk at a time and in
 * parallel; one pass serves all sections and stops as soon as each has been found, so a section
 * that was never recorded costs one scan of the history, not one per section and one read at a time.
 *
 *   readDay(date)  resolves to that day's entries ({ [sectionId]: { value } })
 *
 * Resolves to { [sectionId]: "72" } for the sections that were found; the others are left out.
 */
export async function findRecentNumberValues({ dates, before, sectionIds, readDay, chunkSize = CHUNK_SIZE }) {
  const wanted = new Set(sectionIds)
  const found = {}
  const candidates = dates.filter(date => date < before).sort((a, b) => b.localeCompare(a))

  for (let start = 0; start < candidates.length && wanted.size > 0; start += chunkSize) {
    const days = await Promise.all(candidates.slice(start, start + chunkSize).map(readDay))
    // Newest first inside the chunk too, so the first hit for a section is its latest value.
    for (const day of days) {
      for (const sectionId of [...wanted]) {
        const entry = day?.[sectionId]
        if (!hasStoredValue(entry)) continue
        found[sectionId] = storedText(entry.value)
        wanted.delete(sectionId)
      }
    }
  }
  return found
}
