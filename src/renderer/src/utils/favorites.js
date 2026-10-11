const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function favoriteKey(date, sectionId) {
  return `${date}::${sectionId}`
}

// Favorites are stored in metadata.json as [{ date, sectionId, addedAt }], one per
// section of one day. Anything malformed or duplicated is dropped on load.
export function normalizeFavorites(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const result = []
  for (const item of value) {
    if (!item || typeof item.date !== 'string' || !DATE_PATTERN.test(item.date)) continue
    if (typeof item.sectionId !== 'string' || item.sectionId === '') continue
    const key = favoriteKey(item.date, item.sectionId)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({
      date: item.date,
      sectionId: item.sectionId,
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : ''
    })
  }
  return result
}

export function buildFavoriteLookup(favorites) {
  return new Set((favorites || []).map(item => favoriteKey(item.date, item.sectionId)))
}

export function toggleFavoriteEntry(favorites, date, sectionId, now = new Date().toISOString()) {
  const list = favorites || []
  const key = favoriteKey(date, sectionId)
  if (list.some(item => favoriteKey(item.date, item.sectionId) === key)) {
    return list.filter(item => favoriteKey(item.date, item.sectionId) !== key)
  }
  return [...list, { date, sectionId, addedAt: now }]
}

// Everything persisted in metadata.json, in one place so no writer can forget a field.
export function buildMetadataContent({ countdowns, analytics, favorites }) {
  return JSON.stringify({
    countdowns: countdowns || [],
    analytics: analytics || [],
    favorites: normalizeFavorites(favorites)
  }, null, 2)
}
