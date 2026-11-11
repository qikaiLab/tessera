import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { favoriteKey } from '../../utils/favorites'
import { richTextToPlainText } from '../../utils/richText'
import './TimelineCard.css'

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// `text` with every occurrence of `query` wrapped in <mark>.
function highlightText(text, query) {
  if (!query || !text) return text
  const pattern = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return text.split(pattern).map((part, i) => (pattern.test(part) ? <mark key={i}>{part}</mark> : part))
}

function SectionTag({ section, favorite }) {
  return (
    <span className="tl-section-tag">
      {section.color && (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: section.color,
            marginRight: 4,
            flexShrink: 0,
            verticalAlign: 'middle',
          }}
        />
      )}
      {favorite && <span className="tl-favorite-mark" aria-label="已收藏">★</span>}
      {section.name}
    </span>
  )
}

// Without a section filter: the day's section tags and word count, then either a one-line taste
// of its first text entry or (when searching / showing favourites) a snippet per section.
function OverviewContent({ card, query, showSnippets, favoriteLookup, onToggleFavorite }) {
  const { dateStr, totalWords, recordedSections, sectionResults } = card
  const leadEntry = sectionResults.find(result => result.sec.type !== 'number' && result.text.trim())
  const leadText = leadEntry
    ? richTextToPlainText(leadEntry.rawValue).replace(/\s+/g, ' ').slice(0, 140)
    : ''

  return (
    <>
      <div className="tl-meta">
        <div className="tl-sections">
          {recordedSections.map(section => (
            <SectionTag key={section.id} section={section} favorite={favoriteLookup.has(favoriteKey(dateStr, section.id))} />
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
  )
}

// With sections selected in the filter: one row per selected section.
function SectionRows({ results, query }) {
  return results.map(({ sec, snippet, wordCount, rawValue }) => (
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
  ))
}

// One day in the list view.
export default function TimelineCard({
  card, revealRef, query, onClick, filterSections, showSnippets, favoriteLookup, onToggleFavorite,
  isManageMode, isSelected, onToggleSelect
}) {
  const date = parseISO(card.dateStr)

  const handleCardClick = (event) => {
    if (isManageMode) {
      event.stopPropagation()
      onToggleSelect()
    } else {
      onClick()
    }
  }

  // The card is the control: it opens the day (or, while managing, ticks it) from the keyboard too.
  // Keys that belong to a button inside it (the favourite star) are left to that button.
  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick(event)
    }
  }

  return (
    <div
      className={`timeline-card ${isManageMode ? 'manage-mode-card' : ''} ${isSelected ? 'selected' : ''}`}
      // Cards play their entrance as they scroll into view (see useScrollReveal).
      data-reveal="pending"
      ref={revealRef}
      role={isManageMode ? 'checkbox' : 'button'}
      // A short name (the day and its size), not the card's whole text: the star inside it is a button of its own.
      aria-label={`${format(date, 'yyyy年M月d日 EEEE', { locale: zhCN })}，${card.totalWords} 字`}
      aria-checked={isManageMode ? isSelected : undefined}
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {isManageMode && (
        <div className={`tl-card-checkbox-custom ${isSelected ? 'selected' : ''}`} aria-hidden="true" onClick={(e) => { e.stopPropagation(); onToggleSelect() }}>
          <div className="checkbox-inner">
            {isSelected && '✓'}
          </div>
        </div>
      )}
      <div className="timeline-card-date">
        <span className="tl-date-main">{format(date, 'MM月dd日')}</span>
        <span className="tl-date-week">{format(date, 'EEEE', { locale: zhCN })}</span>
        <span className="tl-date-year">{format(date, 'yyyy年')}</span>
      </div>
      <div className="timeline-card-divider" />
      <div className="timeline-card-content">
        {filterSections.length === 0
          ? <OverviewContent card={card} query={query} showSnippets={showSnippets} favoriteLookup={favoriteLookup} onToggleFavorite={onToggleFavorite} />
          : <SectionRows results={card.sectionResults} query={query} />}
      </div>
    </div>
  )
}
