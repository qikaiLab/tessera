import { describe, expect, it } from 'vitest'
import {
  buildFavoriteLookup,
  buildMetadataContent,
  favoriteKey,
  normalizeFavorites,
  toggleFavoriteEntry
} from '../src/renderer/src/utils/favorites.js'

describe('favorites', () => {
  it('adds and removes one favorite per section of a day', () => {
    const added = toggleFavoriteEntry([], '2026-05-01', 'diary', 'now')
    expect(added).toEqual([{ date: '2026-05-01', sectionId: 'diary', addedAt: 'now' }])
    expect(toggleFavoriteEntry(added, '2026-05-01', 'study', 'later')).toHaveLength(2)
    expect(toggleFavoriteEntry(added, '2026-05-01', 'diary')).toEqual([])
  })

  it('does not mutate the previous list', () => {
    const list = [{ date: '2026-05-01', sectionId: 'diary', addedAt: '' }]
    toggleFavoriteEntry(list, '2026-05-01', 'diary')
    expect(list).toHaveLength(1)
  })

  it('looks favorites up by date and section', () => {
    const lookup = buildFavoriteLookup([{ date: '2026-05-01', sectionId: 'diary', addedAt: '' }])
    expect(lookup.has(favoriteKey('2026-05-01', 'diary'))).toBe(true)
    expect(lookup.has(favoriteKey('2026-05-02', 'diary'))).toBe(false)
  })

  it('drops malformed and duplicate entries on load', () => {
    expect(normalizeFavorites(undefined)).toEqual([])
    expect(normalizeFavorites('nope')).toEqual([])
    expect(normalizeFavorites([
      { date: '2026-05-01', sectionId: 'diary', addedAt: 't' },
      { date: '2026-05-01', sectionId: 'diary' },
      { date: '05/01/2026', sectionId: 'diary' },
      { date: '2026-05-02', sectionId: '' },
      null
    ])).toEqual([{ date: '2026-05-01', sectionId: 'diary', addedAt: 't' }])
  })

  it('serializes every metadata field, including favorites', () => {
    const parsed = JSON.parse(buildMetadataContent({
      countdowns: [{ id: 1 }],
      analytics: [{ id: 'a' }],
      favorites: [{ date: '2026-05-01', sectionId: 'diary', addedAt: 't' }]
    }))
    expect(parsed.countdowns).toEqual([{ id: 1 }])
    expect(parsed.analytics).toEqual([{ id: 'a' }])
    expect(parsed.favorites).toHaveLength(1)
    expect(JSON.parse(buildMetadataContent({})).favorites).toEqual([])
  })
})
