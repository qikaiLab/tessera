import { endOfDay, parseISO, startOfDay } from 'date-fns'
import { favoriteKey } from './favorites'
import { extractPlainText } from './richText'

// Turning the recorded days into the cards the timeline lists. `loadedDates` maps a date to that
// day's entries ({ [sectionId]: { value } }).

export function countWords(text) {
  if (!text) return 0
  return text.replace(/\s+/g, '').length
}

// A short stretch of `text` around the first match of `query` (or its start), with "..." where
// it was cut.
export function getSnippet(text, query, maxLen = 120) {
  if (!query) return text?.slice(0, maxLen) || ''
  const index = text?.toLowerCase().indexOf(query.toLowerCase()) ?? -1
  if (index === -1) return text?.slice(0, maxLen) || ''
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + query.length + 80)
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
}

function isInDateRange(dateStr, dateFrom, dateTo) {
  const date = parseISO(dateStr)
  if (dateFrom && date < startOfDay(parseISO(dateFrom))) return false
  if (dateTo && date > endOfDay(parseISO(dateTo))) return false
  return true
}

// The sections of one day that pass the filters, each with its text, a snippet and word count.
function matchSections(dateStr, dayData, sections, { filterSections, query, onlyFavorites }, favoriteLookup) {
  const sectionIds = filterSections.length === 0 ? Object.keys(dayData) : filterSections
  const needle = query.toLowerCase()

  return sectionIds
    .filter(id => {
      if (!sections.some(section => section.id === id)) return false
      const entry = dayData[id]
      if (!entry || entry.value === undefined) return false
      return !query || extractPlainText(entry.value).toLowerCase().includes(needle)
    })
    .filter(id => !onlyFavorites || favoriteLookup.has(favoriteKey(dateStr, id)))
    .map(id => {
      const section = sections.find(item => item.id === id)
      const rawValue = dayData[id]?.value
      const text = extractPlainText(rawValue)
      return { sec: section, text, snippet: getSnippet(text, query), wordCount: countWords(text), rawValue }
    })
}

/**
 * The days the timeline lists, in order: those inside the date range with a recorded section that
 * passes the filters (selected sections, text search, favourites only).
 *
 * Each card is { dateStr, dayData, sectionResults, totalWords, recordedSections }; `totalWords`
 * counts the day's text sections only.
 */
export function buildTimelineCards({ datesWithData, loadedDates, sections, filters, favoriteLookup }) {
  const { filterSections, sortDesc, query, dateFrom, dateTo, onlyFavorites } = filters
  const ordered = [...datesWithData].sort((a, b) => (sortDesc ? b.localeCompare(a) : a.localeCompare(b)))

  return ordered.map(dateStr => {
    const dayData = loadedDates[dateStr] || {}
    if (!isInDateRange(dateStr, dateFrom, dateTo)) return null

    const sectionResults = matchSections(dateStr, dayData, sections, filters, favoriteLookup)
    if (sectionResults.length === 0 && (query || onlyFavorites)) return null
    // With sections selected, days that have none of them are hidden.
    if (sectionResults.length === 0 && filterSections.length > 0) return null

    const totalWords = Object.entries(dayData).reduce((total, [id, entry]) => {
      if (sections.find(section => section.id === id)?.type === 'number') return total
      return total + countWords(extractPlainText(entry?.value))
    }, 0)
    const recordedSections = Object.keys(dayData)
      .map(id => sections.find(section => section.id === id))
      .filter(Boolean)
    if (recordedSections.length === 0) return null

    return { dateStr, dayData, sectionResults, totalWords, recordedSections }
  }).filter(Boolean)
}
