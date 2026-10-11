import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import EasterEgg from '../components/EasterEgg'
import SelectMenu from '../components/SelectMenu'
import TimelinePreview from '../components/TimelinePreview'
import { getPresetRange, RANGE_PRESETS } from '../utils/timelineRange'
import { buildFavoriteLookup, favoriteKey } from '../utils/favorites'
import './Timeline.css'

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
      const confirmMsg = `确定要删除所选的这 ${count} 天的全部记录吗？\n该操作将永久物理删除文件，且无法撤销！`
      confirmed = await confirm({
        message: confirmMsg,
        title: '确认删除',
        confirmText: '确定删除',
        danger: true
      })
    } else {
      const confirmMsg = `确定要清除所选这 ${count} 天的${clearedNames}版块数据吗？\n其他版块的内容将会被保留。`
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

      {/* Filters */}
      <div className="timeline-filters">
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
        <div className="timeline-section-filter">
          <SelectMenu
            multiple
            ariaLabel="筛选版块"
            placeholder="所有版块"
            options={sections.map(s => ({ value: s.id, label: s.name, color: s.color }))}
            value={filterSections}
            onChange={setFilterSections}
          />
        </div>
        <button
          type="button"
          className={`btn btn-sm timeline-favorite-filter ${onlyFavorites ? 'btn-secondary is-active' : 'btn-ghost'}`}
          aria-pressed={onlyFavorites}
          onClick={() => setOnlyFavorites(value => !value)}
          title="只看已收藏的内容"
        >
          {onlyFavorites ? '★' : '☆'} 收藏{favorites.length ? ` ${favorites.length}` : ''}
        </button>
        <div className="timeline-range-preset">
          <SelectMenu
            ariaLabel="快捷时间范围"
            placeholder="快捷范围"
            options={RANGE_PRESETS}
            value={undefined}
            onChange={(preset) => {
              const range = getPresetRange(preset)
              setDateFrom(range.from)
              setDateTo(range.to)
            }}
          />
        </div>
        <input
          type="date"
          className="input"
          style={{ width: 140 }}
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          placeholder="开始日期"
          title="开始日期"
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        <input
          type="date"
          className="input"
          style={{ width: 140 }}
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          placeholder="结束日期"
          title="结束日期"
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm timeline-sort-btn"
          onClick={() => setSortDesc(value => !value)}
          title="切换日期排序"
        >
          {sortDesc ? '↓ 新到旧' : '↑ 旧到新'}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${isPreview ? 'btn-secondary' : 'btn-primary'}`}
          aria-pressed={isPreview}
          onClick={() => {
            setViewMode(isPreview ? 'list' : 'preview')
            setIsManageMode(false)
            setSelectedDates(new Set())
          }}
          title={isPreview ? '回到时间线列表' : '按当前筛选条件阅读完整内容'}
        >
          {isPreview ? '退出预览' : '📖 预览'}
        </button>
        <button
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
        {(query || filterSections.length > 0 || dateFrom || dateTo || onlyFavorites) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setQuery(''); setFilterSections([]); setDateFrom(''); setDateTo(''); setOnlyFavorites(false) }}
          >
            ✕ 清除
          </button>
        )}
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
            {filteredCards.map(card => (
              <TimelineCard
                key={card.dateStr}
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
          </>
          )
        )}
      </div>
    </div>
  )
}

function TimelineCard({ card, query, onClick, filterSections, showSnippets, favoriteLookup, onToggleFavorite, isManageMode, isSelected, onToggleSelect }) {
  const { dateStr, totalWords, recordedSections, sectionResults } = card
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
    <div className={`timeline-card animate-fade-in ${isManageMode ? 'manage-mode-card' : ''} ${isSelected ? 'selected' : ''}`} onClick={handleCardClick}>
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
