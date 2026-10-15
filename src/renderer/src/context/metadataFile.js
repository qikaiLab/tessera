import { normalizeFavorites } from '../utils/favorites'

const LEGACY_COUNTDOWNS_KEY = 'mototrace_countdowns'
const LEGACY_ANALYTICS_KEY = 'mototrace_analytics'

function readLegacyList(storage, key) {
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

/**
 * The countdowns, charts and favourites of metadata.json (`raw` is its text).
 *
 * Older versions kept countdowns and charts in localStorage; when the file has none of a kind
 * but localStorage does, that is used and `migrated` is true so the caller writes it into the
 * file and clears localStorage. Throws if `raw` is not valid JSON.
 */
export function parseMetadata(raw, storage) {
  const meta = JSON.parse(raw)
  let countdowns = meta.countdowns || []
  let analytics = meta.analytics || []
  let migrated = false

  if (countdowns.length === 0) {
    const legacy = readLegacyList(storage, LEGACY_COUNTDOWNS_KEY)
    if (legacy) { countdowns = legacy; migrated = true }
  }
  if (analytics.length === 0) {
    const legacy = readLegacyList(storage, LEGACY_ANALYTICS_KEY)
    if (legacy) { analytics = legacy; migrated = true }
  }

  return { countdowns, analytics, favorites: normalizeFavorites(meta.favorites), rawFavorites: meta.favorites, migrated }
}

export function clearLegacyMetadata(storage) {
  storage.removeItem(LEGACY_COUNTDOWNS_KEY)
  storage.removeItem(LEGACY_ANALYTICS_KEY)
}
