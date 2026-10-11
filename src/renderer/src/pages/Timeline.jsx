import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import EasterEgg from '../components/EasterEgg'
import SelectMenu from '../components/SelectMenu'
import DateRangeMenu from '../components/DateRangeMenu'
import TimelinePreview from '../components/TimelinePreview'
import { buildFavoriteLookup, favoriteKey } from '../utils/favorites'
import { richTextToPlainText } from '../utils/richText'
import { useIncrementalList } from '../utils/useIncrementalList'
import { useSlidingThumb } from '../utils/useSlidingThumb'
import '../components/FilterChip.css'
import './Timeline.css'

const TIMELINE_PAGE_SIZE = 40

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countWords(text) {
  if (!text) return 0
  return text.replace(/\s+/g, '').length
}

/**
 * Extract plain text from a Tiptap JSON doc or raw string.
 * Handles both new JSON format and legacy plain text.
 */
function extractText(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    // Try to parse as Tiptap JSON
    try {
      const json = JSON.parse(value)
      return extractTextFromNode(json)
    } catch {
      return value // legacy plain text
    }
  }
  if (typeof value === 'object') {
    return extractTextFromNode(value)
  }
  return String(value)
}

function extractTextFromNode(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('')
  }
  return ''
}

function isValueEmpty(val) {
  if (val === undefined || val === null) return true
  const text = extractText(val).trim()
  return text === ''
}

function highlightText(text, query) {
  if (!query || !text) return text
  const re = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i}>{p}</mark> : p
  )
}

function getSnippet(text, query, maxLen = 120) {
  if (!query) return text?.slice(0, maxLen) || ''
  const idx = text?.toLowerCase().indexOf(query.toLowerCase()) ?? -1
  if (idx === -1) return text?.slice(0, maxLen) || ''
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
}

export default function Timeline() {
  const viewSwitchThumbRef = useSlidingThumb()
  const navigate = useNavigate()
  const { sections, datesWithData, readDayData, writeDayData, setSelectedDate, showToast, refreshDates, confirm, favorites, toggleFavorite } = useApp()
  const [query, setQuery] = useState('')
  const [easterEggSearch, setEasterEggSearch] = useState('')
  // Empty = every section; otherwise only the listed section ids.
  const [filterSections, setFilterSections] = useState([])
  const [sortDesc, setSortDesc] = useState(true)
  const [viewMode, setViewMode] = useState('list')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedDates, setLoadedDates] = useState({})

  // Management states
  const [isManageMode, setIsManageMode] = useState(false)
  const [selectedDates, setSelectedDates] = useState(new Set())

  // Load all day data
  useEffect(() => {
    if (!datesWithData.length) {
      setLoading(false)
      return
    }
    setLoading(true)
    let aborted = false
    const fetchAll = async () => {
      // Fix #6: Parallel loading instead of serial for...await
      const entries = await Promise.all(
        datesWithData.map(async (d) => [d, await readDayData(d)])
      )
      if (aborted) return
      const result = {}
      for (const [d, data] of entries) {
        result[d] = data
      }
      setLoadedDates(result)
      setLoading(false)
    }
    fetchAll()
    return () => { aborted = true }
  }, [datesWithData, readDayData])

  const favoriteLookup = useMemo(() => buildFavoriteLookup(favorites), [favorites])
  const isPreview = viewMode === 'preview'
  const hasActiveFilter = Boolean(query || filterSections.length > 0 || dateFrom || dateTo || onlyFavorites)
  const sectionFilterLabel = filterSections.length === 0
    ? '所有版块'
    : filterSections.length === 1
      ? (sections.find(item => item.id === filterSections[0])?.name || '1 个版块')
      : `${filterSections.length} 个版块`

  const switchView = (mode) => {
    setViewMode(mode)
    setIsManageMode(false)
    setSelectedDates(new Set())
  }

  const filteredCards = useMemo(() => {
    const sortedDates = [...datesWithData].sort((a, b) => (sortDesc ? b.localeCompare(a) : a.localeCompare(b)))

    return sortedDates.map(dateStr => {
      const dayData = loadedDates[dateStr] || {}

      // Section filter
      const sectionIds = filterSections.length === 0
        ? Object.keys(dayData)
        : filterSections

      // Date range filter
      if (dateFrom) {
        const d = parseISO(dateStr)
        const from = startOfDay(parseISO(dateFrom))
        if (d < from) return null
      }
      if (dateTo) {
        const d = parseISO(dateStr)
        const to = endOfDay(parseISO(dateTo))
        if (d > to) return null
      }

      // Build content snippets per section
      const sectionResults = sectionIds
        .filter(sid => {
          const sec = sections.find(s => s.id === sid)
          if (!sec) return false
          const entry = dayData[sid]
          if (!entry || entry.value === undefined) return false

          // Full text search
          if (query) {
            const text = extractText(entry.value)
            return text.toLowerCase().includes(query.toLowerCase())
          }
          return true
        })
        .filter(sid => !onlyFavorites || favoriteLookup.has(favoriteKey(dateStr, sid)))
        .map(sid => {
          const sec = sections.find(s => s.id === sid)
          const entry = dayData[sid]
          const rawValue = entry?.value
          const text = extractText(entry?.value)
          const snippet = getSnippet(text, query)
          return { sec, text, snippet, wordCount: countWords(text), rawValue }
        })

      if (sectionResults.length === 0 && (query || onlyFavorites)) return null
      // Task 3: when a specific section is selected, hide dates where
      // that section has no recorded data
      if (sectionResults.length === 0 && filterSections.length > 0) return null

      const totalWords = Object.entries(dayData).reduce((acc, [sid, e]) => {
        const sec = sections.find(s => s.id === sid)
        if (sec?.type === 'number') return acc   // skip numeric sections
        return acc + countWords(extractText(e?.value))
      }, 0)
      const recordedSections = Object.keys(dayData)
        .map(sid => sections.find(s => s.id === sid))
        .filter(Boolean)

      if (recordedSections.length === 0) return null

      return { dateStr, dayData, sectionResults, totalWords, recordedSections }
    }).filter(Boolean)
  }, [datesWithData, loadedDates, filterSections, sortDesc, query, dateFrom, dateTo, sections, onlyFavorites, favoriteLookup])

  // Long histories render in batches so the DOM and memory stay small.
  const listSignature = `${filteredCards.length}:${filteredCards[0]?.dateStr ?? ''}:${filteredCards[filteredCards.length - 1]?.dateStr ?? ''}`
  const cardList = useIncrementalList(filteredCards, TIMELINE_PAGE_SIZE, listSignature)

  const handleCardClick = (dateStr) => {
    setSelectedDate(parseISO(dateStr))
    navigate('/today')
  }

  const handleToggleSelect = (dateStr) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) {
        next.delete(dateStr)
      } else {
        next.add(dateStr)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedDates(prev => {
      if (prev.size === filteredCards.length) {
        return new Set()
      } else {
        return new Set(filteredCards.map(c => c.dateStr))
      }
    })
  }

  const handleBatchDelete = async () => {
    if (selectedDates.size === 0) return
    const count = selectedDates.size
    
    const clearedSections = filterSections
      .map(id => sections.find(s => s.id === id))
      .filter(Boolean)
    const clearedNames = clearedSections.map(section => `「${section.name}」`).join('、')

    let confirmed = false
    if (filterSections.length === 0) {
      const confirmMsg = `确定要删除所选的这 ${count} 天的全部记录吗？\n这些日期的记录文件会被移除；删除前的内容会存入自动历史，之后可在「设置 → 数据与备份 → 查看自动历史」中恢复。`
      confirmed = await confirm({
        message: confirmMsg,
        title: '确认删除',
        confirmText: '确定删除',
        danger: true
      })
    } else {
      const confirmMsg = `确定要清除所选这 ${count} 天的${clearedNames}版块数据吗？\n其他版块的内容将会被保留；清除前的内容会存入自动历史，可在「设置 → 数据与备份 → 查看自动历史」中恢复。`
      confirmed = await confirm({
        message: confirmMsg,
        title: '确认清除版块',
        confirmText: '确定清除',
        danger: true
      })
    }
    
    if (!confirmed) return

    setLoading(true)
    try {
      if (filterSections.length === 0) {
        const promises = Array.from(selectedDates).map(dateStr => {
          const [year, month, day] = dateStr.split('-')
          const filePath = `${year}/${month}/${day}.json`
          return window.api.fs.deleteFile(filePath)
        })
        await Promise.all(promises)
        showToast(`成功删除 ${count} 天的记录`, 'success')
      } else {
        const promises = Array.from(selectedDates).map(async (dateStr) => {
          const dayData = loadedDates[dateStr] || {}
          const updatedData = { ...dayData }
          for (const id of filterSections) delete updatedData[id]
          
          const hasContentLeft = Object.values(updatedData).some(
            entry => entry?.value !== undefined && entry?.value !== null && !isValueEmpty(entry.value)
          )
          
          if (hasContentLeft) {
            return writeDayData(dateStr, updatedData)
          } else {
            const [year, month, day] = dateStr.split('-')
            const filePath = `${year}/${month}/${day}.json`
            return window.api.fs.deleteFile(filePath)
          }
        })
        await Promise.all(promises)
        showToast(`成功清除 ${count} 天的${clearedNames}数据`, 'success')
      }

      // Refresh the date list in context
      await refreshDates()

      // Clear selection and exit management mode
      setSelectedDates(new Set())
      setIsManageMode(false)
    } catch (e) {
      console.error(e)
      showToast('删除失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e) => {
    setQuery(e.target.value)
    setEasterEggSearch('')
  }

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return
    setEasterEggSearch(query.trim())
  }

  // Easter egg: trigger only after submitting an exact private code.
  const easterEggKeywords = ['Wmm', '7kai']
  const easterEggActive = easterEggKeywords.some(kw => easterEggSearch === kw)

  return (
    <div className="timeline-page">
      <EasterEgg active={easterEggActive} />
      {/* Header */}
      <div className="page-header">
        <span className="page-title">时间线</span>
        <div className="timeline-stats">
          <span className="stat-item">{datesWithData.length} 天记录</span>
        </div>
      </div>

      {/* Toolbar: search + view/manage on top, filters underneath */}
      <div className="timeline-toolbar">
        <div className="timeline-toolbar-main">
          <div className="search-wrap flex-1">
            <span className="search-icon">⌕</span>
            <input
              className="input search-input"
              placeholder="搜索记录内容..."
              value={query}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div className="segmented-control timeline-view-switch" role="radiogroup" aria-label="查看方式" ref={viewSwitchThumbRef}>
            <button
              type="button"
              role="radio"
              aria-checked={!isPreview}
              className={`segmented-btn ${!isPreview ? 'active' : ''}`}
              onClick={() => switchView('list')}
              title="按日期查看摘要"
            >
              ☰ 列表
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isPreview}
              className={`segmented-btn ${isPreview ? 'active' : ''}`}
              onClick={() => switchView('preview')}
              title="按当前筛选条件连续阅读完整内容"
            >
              📖 预览
            </button>
          </div>
          <button
            type="button"
            className={`btn btn-sm ${isManageMode ? 'btn-secondary' : 'btn-ghost'}`}
            disabled={isPreview || onlyFavorites}
            onClick={() => {
              setIsManageMode(!isManageMode)
              setSelectedDates(new Set())
            }}
            title={isPreview ? '预览模式下不可管理' : onlyFavorites ? '收藏视图下不可批量删除' : isManageMode ? '退出管理' : '管理时间线'}
          >
            {isManageMode ? '退出管理' : '⚙ 管理'}
          </button>
        </div>

        <div className="timeline-toolbar-filters">
          <SelectMenu
            multiple
            ariaLabel="筛选版块"
            options={sections.map(s => ({ value: s.id, label: s.name, color: s.color }))}
            value={filterSections}
            onChange={setFilterSections}
            trigger={({ ref, props, open }) => (
              <button
                ref={ref}
                {...props}
                className={`filter-chip ${filterSections.length ? 'is-active' : ''} ${open ? 'is-open' : ''}`}
              >
                <span className="filter-chip-icon" aria-hidden="true">▤</span>
                <span className="filter-chip-text">{sectionFilterLabel}</span>
                <span className="filter-chip-chevron" aria-hidden="true">▾</span>
              </button>
            )}
          />
          <DateRangeMenu
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
          />
          <button
            type="button"
            className={`filter-chip ${onlyFavorites ? 'is-active' : ''}`}
            aria-pressed={onlyFavorites}
            onClick={() => setOnlyFavorites(value => !value)}
            title="只看已收藏的内容"
          >
            <span className="filter-chip-icon" aria-hidden="true">{onlyFavorites ? '★' : '☆'}</span>
            <span className="filter-chip-text">收藏{favorites.length ? ` ${favorites.length}` : ''}</span>
          </button>
          <span className="timeline-toolbar-spacer" />
          <button
            type="button"
            className="filter-chip"
            onClick={() => setSortDesc(value => !value)}
            title="切换日期排序"
          >
            <span className="filter-chip-text">{sortDesc ? '↓ 新到旧' : '↑ 旧到新'}</span>
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              className="filter-chip is-clear"
              onClick={() => { setQuery(''); setFilterSections([]); setDateFrom(''); setDateTo(''); setOnlyFavorites(false) }}
            >
              <span className="filter-chip-text">✕ 清除筛选</span>
            </button>
          )}
        </div>
      </div>

      {/* Sticky Manage Bar */}
      {isManageMode && !isPreview && (
        <div className="timeline-manage-bar">
          <div className="manage-info">
            已选择 <strong className="selected-count">{selectedDates.size}</strong> 天记录
          </div>
          <div className="manage-actions">
            <button className="btn btn-ghost btn-sm" onClick={handleSelectAll}>
              {selectedDates.size === filteredCards.length ? '取消全选' : '全选'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              disabled={selectedDates.size === 0}
              onClick={handleBatchDelete}
            >
              🗑 批量删除
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="timeline-list">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto', width: 24, height: 24, borderWidth: 2, borderColor: 'var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">{onlyFavorites ? '☆' : query ? '🔍' : '📋'}</span>
            <p className="empty-state-title">{onlyFavorites ? '还没有符合条件的收藏' : query ? '没有找到匹配记录' : '暂无记录'}</p>
            <p className="empty-state-desc">{onlyFavorites ? '在「记录」页点击版块标题栏的 ☆，即可收藏当天的这个版块' : query ? '尝试其他关键词或调整筛选条件' : '去「今日记录」页面开始你的第一条记录吧'}</p>
          </div>
        ) : (
          isPreview ? (
            <TimelinePreview
              cards={filteredCards}
              sections={sections}
              query={query}
              favoriteLookup={favoriteLookup}
              onToggleFavorite={toggleFavorite}
              onOpenDay={handleCardClick}
            />
          ) : (
          <>
            {query && (
              <div className="search-result-count">
                找到 {filteredCards.length} 条记录
              </div>
            )}
            {cardList.visible.map((card, index) => (
              <TimelineCard
                key={card.dateStr}
                motionIndex={index}
                card={card}
                query={query}
                onClick={() => handleCardClick(card.dateStr)}
                filterSections={filterSections}
                showSnippets={Boolean(query) || onlyFavorites}
                favoriteLookup={favoriteLookup}
                onToggleFavorite={toggleFavorite}
                isManageMode={isManageMode}
                isSelected={selectedDates.has(card.dateStr)}
                onToggleSelect={() => handleToggleSelect(card.dateStr)}
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
        )}
      </div>
    </div>
  )
}

function TimelineCard({ card, motionIndex, query, onClick, filterSections, showSnippets, favoriteLookup, onToggleFavorite, isManageMode, isSelected, onToggleSelect }) {
  const { dateStr, totalWords, recordedSections, sectionResults } = card
  // A one-line taste of the day's first text entry, so the list is more than a row of tags.
  const leadEntry = sectionResults.find(result => result.sec.type !== 'number' && result.text.trim())
  const leadText = leadEntry
    ? richTextToPlainText(leadEntry.rawValue).replace(/\s+/g, ' ').slice(0, 140)
    : ''
  const date = parseISO(dateStr)
  const dayOfWeek = format(date, 'EEEE', { locale: zhCN })
  const dateDisplay = format(date, 'MM月dd日')
  const yearDisplay = format(date, 'yyyy年')

  const handleCardClick = (e) => {
    if (isManageMode) {
      e.stopPropagation()
      onToggleSelect()
    } else {
      onClick()
    }
  }

  return (
    <div
      className={`timeline-card animate-fade-in ${isManageMode ? 'manage-mode-card' : ''} ${isSelected ? 'selected' : ''}`}
      // The first screenful arrives in a short cascade; later batches simply appear.
      style={motionIndex < 8 ? { animationDelay: `${motionIndex * 30}ms` } : undefined}
      onClick={handleCardClick}
    >
      {isManageMode && (
        <div className={`tl-card-checkbox-custom ${isSelected ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
          <div className="checkbox-inner">
            {isSelected && '✓'}
          </div>
        </div>
      )}
      <div className="timeline-card-date">
        <span className="tl-date-main">{dateDisplay}</span>
        <span className="tl-date-week">{dayOfWeek}</span>
        <span className="tl-date-year">{yearDisplay}</span>
      </div>
      <div className="timeline-card-divider" />
      <div className="timeline-card-content">
        {filterSections.length === 0 ? (
          <>
            <div className="tl-meta">
              <div className="tl-sections">
                {recordedSections.map(sec => (
                  <span
                    key={sec.id}
                    className="tl-section-tag"
                  >
                    {sec.color && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: sec.color,
                          marginRight: 4,
                          flexShrink: 0,
                          verticalAlign: 'middle',
                        }}
                      />
                    )}
                    {favoriteLookup.has(favoriteKey(dateStr, sec.id)) && <span className="tl-favorite-mark" aria-label="已收藏">★</span>}
                    {sec.name}
                  </span>
                ))}
              </div>
              <span className="tl-wordcount">{totalWords} 字</span>
            </div>
            {!showSnippets && leadText && <div className="tl-lead">{leadText}</div>}
            {showSnippets && sectionResults.map(({ sec, snippet, rawValue }) => (
              <div key={sec.id} className="tl-snippet">
                <span className="tl-snippet-label">{sec.name}</span>
                <span className="tl-snippet-text selectable">
                  {sec.type === 'number'
                    ? `${rawValue ?? ''}${sec.unit ? ` ${sec.unit}` : ''}`
                    : highlightText(snippet, query)}
                </span>
                {favoriteLookup.has(favoriteKey(dateStr, sec.id)) && (
                  <button
                    type="button"
                    className="tl-favorite-toggle"
                    title="取消收藏"
                    aria-label={`取消收藏${sec.name}`}
                    onClick={(event) => { event.stopPropagation(); onToggleFavorite(dateStr, sec.id) }}
                  >
                    ★
                  </button>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            {sectionResults.map(({ sec, snippet, wordCount, rawValue }) => (
              <div key={sec.id} className="tl-section-row">
                <span className="tl-snippet-label">{sec.name}</span>
                {sec.type === 'number' ? (
                  <span className="tl-numeric-value">
                    {rawValue !== undefined && rawValue !== null ? rawValue : '—'}
                    {sec.unit ? <span className="tl-numeric-unit"> {sec.unit}</span> : null}
                  </span>
                ) : (
                  <>
                    <span className="tl-snippet-text selectable">{highlightText(snippet, query)}</span>
                    <span className="tl-wordcount">{wordCount} 字</span>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
