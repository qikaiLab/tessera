import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import './Timeline.css'

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countWords(text) {
  if (!text) return 0
  return text.replace(/\s+/g, '').length
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
  const { sections, datesWithData, readDayData, setSelectedDate } = useApp()
  const [query, setQuery] = useState('')
  const [filterSection, setFilterSection] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadedDates, setLoadedDates] = useState({})

  // Load all day data
  useEffect(() => {
    if (!datesWithData.length) {
      setLoading(false)
      return
    }
    setLoading(true)
    const fetchAll = async () => {
      const result = {}
      for (const d of datesWithData) {
        result[d] = await readDayData(d)
      }
      setLoadedDates(result)
      setLoading(false)
    }
    fetchAll()
  }, [datesWithData, readDayData])

  const filteredCards = useMemo(() => {
    const sortedDates = [...datesWithData].sort((a, b) => b.localeCompare(a))

    return sortedDates.map(dateStr => {
      const dayData = loadedDates[dateStr] || {}

      // Section filter
      const sectionIds = filterSection === 'all'
        ? Object.keys(dayData)
        : [filterSection]

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
            const text = String(entry.value || '')
            return text.toLowerCase().includes(query.toLowerCase())
          }
          return true
        })
        .map(sid => {
          const sec = sections.find(s => s.id === sid)
          const entry = dayData[sid]
          const text = String(entry?.value || '')
          const snippet = getSnippet(text, query)
          return { sec, text, snippet, wordCount: countWords(text) }
        })

      if (sectionResults.length === 0 && query) return null

      const totalWords = Object.values(dayData).reduce((acc, e) => acc + countWords(String(e?.value || '')), 0)
      const recordedSections = Object.keys(dayData)
        .map(sid => sections.find(s => s.id === sid))
        .filter(Boolean)

      return { dateStr, dayData, sectionResults, totalWords, recordedSections }
    }).filter(Boolean)
  }, [datesWithData, loadedDates, filterSection, query, dateFrom, dateTo, sections])

  const handleCardClick = (dateStr) => {
    setSelectedDate(parseISO(dateStr))
    navigate('/today')
  }

  return (
    <div className="timeline-page">
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
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 140 }}
          value={filterSection}
          onChange={e => setFilterSection(e.target.value)}
        >
          <option value="all">所有版块</option>
          {sections.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
        {(query || filterSection !== 'all' || dateFrom || dateTo) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setQuery(''); setFilterSection('all'); setDateFrom(''); setDateTo('') }}
          >
            ✕ 清除
          </button>
        )}
      </div>

      {/* List */}
      <div className="timeline-list">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto', width: 24, height: 24, borderWidth: 2, borderColor: 'var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">{query ? '🔍' : '📋'}</span>
            <p className="empty-state-title">{query ? '没有找到匹配记录' : '暂无记录'}</p>
            <p className="empty-state-desc">{query ? '尝试其他关键词或调整筛选条件' : '去「今日记录」页面开始你的第一条记录吧'}</p>
          </div>
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
                filterSection={filterSection}
                sections={sections}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function TimelineCard({ card, query, onClick, filterSection, sections }) {
  const { dateStr, totalWords, recordedSections, sectionResults, dayData } = card
  const date = parseISO(dateStr)
  const dayOfWeek = format(date, 'EEEE', { locale: zhCN })
  const dateDisplay = format(date, 'MM月dd日')
  const yearDisplay = format(date, 'yyyy年')

  return (
    <div className="timeline-card animate-fade-in" onClick={onClick}>
      <div className="timeline-card-date">
        <span className="tl-date-main">{dateDisplay}</span>
        <span className="tl-date-week">{dayOfWeek}</span>
        <span className="tl-date-year">{yearDisplay}</span>
      </div>
      <div className="timeline-card-divider" />
      <div className="timeline-card-content">
        {filterSection === 'all' ? (
          <>
            <div className="tl-meta">
              <div className="tl-sections">
                {recordedSections.map(sec => (
                  <span
                    key={sec.id}
                    className="tl-section-tag"
                    style={sec.color ? {
                      borderLeft: `3px solid ${sec.color}`,
                      paddingLeft: '6px',
                    } : undefined}
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
                    {sec.name}
                  </span>
                ))}
              </div>
              <span className="tl-wordcount">{totalWords} 字</span>
            </div>
            {query && sectionResults.map(({ sec, snippet }) => (
              <div key={sec.id} className="tl-snippet">
                <span className="tl-snippet-label">{sec.name}</span>
                <span className="tl-snippet-text selectable">
                  {highlightText(snippet, query)}
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="tl-meta">
              <span className="tl-wordcount">{sectionResults[0]?.wordCount || 0} 字</span>
            </div>
            {sectionResults.map(({ sec, snippet }) => (
              <div key={sec.id} className="tl-snippet">
                <span className="tl-snippet-text selectable">
                  {highlightText(snippet, query)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
