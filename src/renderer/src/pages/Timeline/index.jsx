import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { useApp } from '../../context/AppContext'
import EasterEgg from '../../components/EasterEgg'
import TimelinePreview from '../../components/TimelinePreview'
import { buildFavoriteLookup } from '../../utils/favorites'
import { buildTimelineCards } from '../../utils/timelineCards'
import { useIncrementalList } from '../../utils/useIncrementalList'
import { useScrollReveal } from '../../utils/useScrollReveal'
import TimelineCard from './TimelineCard'
import TimelineToolbar from './TimelineToolbar'
import { useTimelineData } from './useTimelineData'
import { useTimelineFilters } from './useTimelineFilters'
import { useTimelineManage } from './useTimelineManage'
import './Timeline.css'

// Long histories render in batches so the DOM and memory stay small.
const TIMELINE_PAGE_SIZE = 40

// The easter egg only fires when one of these is submitted (Enter) as the whole search.
const EASTER_EGG_KEYWORDS = ['Wmm', '7kai']

function ManageBar({ manage, cardCount, onDelete }) {
  const allSelected = manage.selectedDates.size === cardCount
  return (
    <div className="timeline-manage-bar">
      <div className="manage-info">
        已选择 <strong className="selected-count">{manage.selectedDates.size}</strong> 天记录
      </div>
      <div className="manage-actions">
        <button className="btn btn-ghost btn-sm" onClick={manage.toggleSelectAll}>
          {allSelected ? '取消全选' : '全选'}
        </button>
        <button className="btn btn-danger btn-sm" disabled={manage.selectedDates.size === 0} onClick={onDelete}>
          🗑 批量删除
        </button>
      </div>
    </div>
  )
}

function EmptyTimeline({ onlyFavorites, query }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{onlyFavorites ? '☆' : query ? '🔍' : '📋'}</span>
      <p className="empty-state-title">{onlyFavorites ? '还没有符合条件的收藏' : query ? '没有找到匹配记录' : '暂无记录'}</p>
      <p className="empty-state-desc">{onlyFavorites ? '在「记录」页点击版块标题栏的 ☆，即可收藏当天的这个版块' : query ? '尝试其他关键词或调整筛选条件' : '去「今日记录」页面开始你的第一条记录吧'}</p>
    </div>
  )
}

// The timeline: every recorded day as a card (or, in preview mode, read in full), with search,
// section / date / favourite filters and a management mode to delete days.
export default function Timeline() {
  const navigate = useNavigate()
  const revealCard = useScrollReveal()
  const { sections, datesWithData, setSelectedDate, favorites, toggleFavorite } = useApp()
  const [viewMode, setViewMode] = useState('list')
  const [easterEggSearch, setEasterEggSearch] = useState('')
  const { loadedDates, loading, setLoading } = useTimelineData()
  const filterState = useTimelineFilters()
  const favoriteLookup = useMemo(() => buildFavoriteLookup(favorites), [favorites])
  const isPreview = viewMode === 'preview'

  const cards = useMemo(
    () => buildTimelineCards({ datesWithData, loadedDates, sections, filters: filterState.filters, favoriteLookup }),
    [datesWithData, loadedDates, sections, filterState.filters, favoriteLookup]
  )
  const manage = useTimelineManage({ cards, filterSections: filterState.filterSections, setLoading })

  const listSignature = `${cards.length}:${cards[0]?.dateStr ?? ''}:${cards[cards.length - 1]?.dateStr ?? ''}`
  const cardList = useIncrementalList(cards, TIMELINE_PAGE_SIZE, listSignature)

  const switchView = (mode) => {
    setViewMode(mode)
    manage.leaveManageMode()
  }

  const openDay = (dateStr) => {
    setSelectedDate(parseISO(dateStr))
    navigate('/today')
  }

  const handleSearchChange = (event) => {
    filterState.setQuery(event.target.value)
    setEasterEggSearch('')
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') setEasterEggSearch(filterState.query.trim())
  }

  const renderList = () => {
    if (loading) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto', width: 24, height: 24, borderWidth: 2, borderColor: 'var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )
    }
    if (cards.length === 0) return <EmptyTimeline onlyFavorites={filterState.onlyFavorites} query={filterState.query} />
    if (isPreview) {
      return (
        <TimelinePreview
          cards={cards}
          sections={sections}
          query={filterState.query}
          favoriteLookup={favoriteLookup}
          onToggleFavorite={toggleFavorite}
          onOpenDay={openDay}
        />
      )
    }
    return (
      <>
        {filterState.query && <div className="search-result-count">找到 {cards.length} 条记录</div>}
        {cardList.visible.map(card => (
          <TimelineCard
            key={card.dateStr}
            revealRef={revealCard}
            card={card}
            query={filterState.query}
            onClick={() => openDay(card.dateStr)}
            filterSections={filterState.filterSections}
            showSnippets={Boolean(filterState.query) || filterState.onlyFavorites}
            favoriteLookup={favoriteLookup}
            onToggleFavorite={toggleFavorite}
            isManageMode={manage.isManageMode}
            isSelected={manage.selectedDates.has(card.dateStr)}
            onToggleSelect={() => manage.toggleSelected(card.dateStr)}
          />
        ))}
        {cardList.hasMore && (
          <div ref={cardList.sentinelRef} className="timeline-more">
            <button type="button" className="btn btn-ghost btn-sm" onClick={cardList.showMore}>
              显示更多（还有 {cardList.remaining} 天）
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="timeline-page">
      <EasterEgg active={EASTER_EGG_KEYWORDS.includes(easterEggSearch)} />
      <div className="page-header">
        <span className="page-title">时间线</span>
        <div className="timeline-stats">
          <span className="stat-item">{datesWithData.length} 天记录</span>
        </div>
      </div>

      <TimelineToolbar
        sections={sections}
        favoritesCount={favorites.length}
        filters={filterState}
        isPreview={isPreview}
        onViewChange={switchView}
        isManageMode={manage.isManageMode}
        onToggleManage={manage.toggleManageMode}
        onSearchChange={handleSearchChange}
        onSearchKeyDown={handleSearchKeyDown}
      />

      {manage.isManageMode && !isPreview && (
        <ManageBar manage={manage} cardCount={cards.length} onDelete={manage.deleteSelected} />
      )}

      <div className="timeline-list">{renderList()}</div>
    </div>
  )
}
