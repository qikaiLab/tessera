import { useMemo, useState } from 'react'

/**
 * The timeline's filters: text search, sections (empty = all), a date range, favourites only,
 * and the sort direction.
 */
export function useTimelineFilters() {
  const [query, setQuery] = useState('')
  const [filterSections, setFilterSections] = useState([])
  const [sortDesc, setSortDesc] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const hasActiveFilter = Boolean(query || filterSections.length > 0 || dateFrom || dateTo || onlyFavorites)

  const clearFilters = () => {
    setQuery('')
    setFilterSections([])
    setDateFrom('')
    setDateTo('')
    setOnlyFavorites(false)
  }

  const filters = useMemo(
    () => ({ filterSections, sortDesc, query, dateFrom, dateTo, onlyFavorites }),
    [filterSections, sortDesc, query, dateFrom, dateTo, onlyFavorites]
  )

  return {
    filters,
    query, setQuery,
    filterSections, setFilterSections,
    sortDesc, toggleSort: () => setSortDesc(value => !value),
    dateFrom, dateTo, setDateRange: (from, to) => { setDateFrom(from); setDateTo(to) },
    onlyFavorites, toggleOnlyFavorites: () => setOnlyFavorites(value => !value),
    hasActiveFilter,
    clearFilters
  }
}
