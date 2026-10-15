import { describe, expect, it } from 'vitest'
import { buildTimelineCards, countWords, getSnippet } from '../src/renderer/src/utils/timelineCards.js'
import { buildFavoriteLookup } from '../src/renderer/src/utils/favorites.js'

const doc = (text) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

const sections = [
  { id: 'diary', name: '日记', type: 'text' },
  { id: 'study', name: '学习', type: 'text' },
  { id: 'steps', name: '步数', type: 'number', unit: '步' }
]

const loadedDates = {
  '2026-10-10': { diary: { value: doc('晨跑 然后 写代码') }, steps: { value: '8000' } },
  '2026-10-11': { study: { value: doc('线性代数 第三章') } },
  '2026-10-12': { steps: { value: '5000' } },
  '2026-10-13': { diary: { value: doc('读完了一本书') }, study: { value: doc('英语') } }
}
const datesWithData = Object.keys(loadedDates)

const noFilters = { filterSections: [], sortDesc: true, query: '', dateFrom: '', dateTo: '', onlyFavorites: false }
const build = (filters = {}, favorites = []) => buildTimelineCards({
  datesWithData,
  loadedDates,
  sections,
  filters: { ...noFilters, ...filters },
  favoriteLookup: buildFavoriteLookup(favorites)
})
const dates = (cards) => cards.map(card => card.dateStr)

describe('snippets and word counts', () => {
  it('counts characters without whitespace', () => {
    expect(countWords('晨跑 然后 写代码')).toBe(7)
    expect(countWords('')).toBe(0)
    expect(countWords(undefined)).toBe(0)
  })

  it('cuts a snippet around the match', () => {
    const text = `${'前'.repeat(100)}关键词${'后'.repeat(200)}`
    const snippet = getSnippet(text, '关键词')
    expect(snippet.startsWith('...')).toBe(true)
    expect(snippet.endsWith('...')).toBe(true)
    expect(snippet).toContain('关键词')
    expect(getSnippet('短文本', '没有')).toBe('短文本')
    expect(getSnippet('x'.repeat(300), '')).toHaveLength(120)
  })
})

describe('building the cards', () => {
  it('lists every recorded day, newest first or oldest first', () => {
    expect(dates(build())).toEqual(['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10'])
    expect(dates(build({ sortDesc: false }))).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'])
  })

  it('counts the words of text sections only', () => {
    const card = build().find(item => item.dateStr === '2026-10-10')
    expect(card.totalWords).toBe(7)
    expect(card.recordedSections.map(section => section.id)).toEqual(['diary', 'steps'])
  })

  it('filters by date range, inclusive of both ends', () => {
    expect(dates(build({ dateFrom: '2026-10-11', dateTo: '2026-10-12' }))).toEqual(['2026-10-12', '2026-10-11'])
    expect(dates(build({ dateFrom: '2026-10-13' }))).toEqual(['2026-10-13'])
  })

  it('searches the text of the entries and keeps only the matching sections', () => {
    const cards = build({ query: '代数' })
    expect(dates(cards)).toEqual(['2026-10-11'])
    expect(cards[0].sectionResults.map(result => result.sec.id)).toEqual(['study'])
    expect(cards[0].sectionResults[0].snippet).toContain('线性代数')
    // The search is case-insensitive and also finds numbers.
    expect(dates(build({ query: '8000' }))).toEqual(['2026-10-10'])
  })

  it('hides days without any of the selected sections', () => {
    const cards = build({ filterSections: ['study'] })
    expect(dates(cards)).toEqual(['2026-10-13', '2026-10-11'])
    expect(cards[0].sectionResults.map(result => result.sec.id)).toEqual(['study'])
  })

  it('keeps only favourites when asked', () => {
    const favorites = [{ date: '2026-10-13', sectionId: 'study' }]
    const cards = build({ onlyFavorites: true }, favorites)
    expect(dates(cards)).toEqual(['2026-10-13'])
    expect(cards[0].sectionResults.map(result => result.sec.id)).toEqual(['study'])
  })

  it('skips days whose sections are all unknown', () => {
    const cards = buildTimelineCards({
      datesWithData: ['2026-10-14'],
      loadedDates: { '2026-10-14': { gone: { value: '1' } } },
      sections,
      filters: noFilters,
      favoriteLookup: buildFavoriteLookup([])
    })
    expect(cards).toEqual([])
  })

  it('does not reorder the list of days it is given', () => {
    const input = ['2026-10-12', '2026-10-10']
    buildTimelineCards({ datesWithData: input, loadedDates, sections, filters: noFilters, favoriteLookup: buildFavoriteLookup([]) })
    expect(input).toEqual(['2026-10-12', '2026-10-10'])
  })
})
