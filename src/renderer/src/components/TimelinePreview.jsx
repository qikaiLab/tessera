import React, { useEffect, useMemo, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import RichTextView from './RichTextView'
import { favoriteKey } from '../utils/favorites'
import { useIncrementalList } from '../utils/useIncrementalList'
import './TimelinePreview.css'

const PAGE_SIZE = 12

function readEditorFontSize() {
  try {
    const stored = parseInt(localStorage.getItem('mototrace_font_size') || '14', 10)
    return Number.isFinite(stored) ? Math.min(Math.max(stored, 12), 24) : 14
  } catch {
    return 14
  }
}

function FavoriteStar({ active, onToggle, label }) {
  return (
    <button
      type="button"
      className={`preview-star ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      aria-label={active ? `取消收藏${label}` : `收藏${label}`}
      title={active ? '取消收藏' : '收藏'}
      onClick={onToggle}
    >
      {active ? '★' : '☆'}
    </button>
  )
}

function DayBlock({ card, sectionOrder, query, favoriteLookup, onToggleFavorite, onOpenDay, fontSize }) {
  const date = parseISO(card.dateStr)
  const ordered = [...card.sectionResults].sort(
    (a, b) => (sectionOrder.get(a.sec.id) ?? 0) - (sectionOrder.get(b.sec.id) ?? 0)
  )
  const numbers = ordered.filter(result => result.sec.type === 'number')
  const texts = ordered.filter(result => result.sec.type !== 'number')

  return (
    <section className="preview-day" aria-label={card.dateStr}>
      <header className="preview-day-header">
        <div className="preview-day-title">
          <span className="preview-day-main">{format(date, 'MM月dd日')}</span>
          <span className="preview-day-week">{format(date, 'EEEE', { locale: zhCN })}</span>
          <span className="preview-day-year">{format(date, 'yyyy年')}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm preview-open-day" onClick={() => onOpenDay(card.dateStr)}>
          在记录页打开 →
        </button>
      </header>

      {numbers.length > 0 && (
        <div className="preview-numbers">
          {numbers.map(({ sec, rawValue }) => (
            <span key={sec.id} className="preview-number">
              {sec.color && <span className="preview-dot" style={{ background: sec.color }} />}
              <span className="preview-number-name">{sec.name}</span>
              <strong className="preview-number-value">{rawValue}</strong>
              {sec.unit && <span className="preview-number-unit">{sec.unit}</span>}
              <FavoriteStar
                active={favoriteLookup.has(favoriteKey(card.dateStr, sec.id))}
                label={sec.name}
                onToggle={() => onToggleFavorite(card.dateStr, sec.id)}
              />
            </span>
          ))}
        </div>
      )}

      {texts.map(({ sec, rawValue, wordCount }) => (
        <article key={sec.id} className="preview-entry">
          <div className="preview-entry-header">
            {sec.color && <span className="preview-dot" style={{ background: sec.color }} />}
            <span className="preview-entry-name">{sec.name}</span>
            <span className="preview-entry-words">{wordCount} 字</span>
            <FavoriteStar
              active={favoriteLookup.has(favoriteKey(card.dateStr, sec.id))}
              label={sec.name}
              onToggle={() => onToggleFavorite(card.dateStr, sec.id)}
            />
          </div>
          <RichTextView value={rawValue} highlight={query} fontSize={fontSize} />
        </article>
      ))}
    </section>
  )
}

// A day's header is "stuck" once its card has scrolled up past the top of the list: it is then
// pinned to the toolbar edge and drops its rounded top corners so it joins the toolbar cleanly.
// The attribute is set straight on the DOM (no re-render per scroll event).
function useStuckHeaders(rootRef, dependency) {
  useEffect(() => {
    const root = rootRef.current
    const scroller = root?.closest('.timeline-list')
    if (!root || !scroller) return undefined

    let frame = 0
    const update = () => {
      frame = 0
      const top = scroller.getBoundingClientRect().top
      for (const day of root.querySelectorAll('.preview-day')) {
        const header = day.firstElementChild
        if (!header) continue
        const stuck = day.getBoundingClientRect().top < top - 0.5
        if (stuck) header.setAttribute('data-stuck', 'true')
        else header.removeAttribute('data-stuck')
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [rootRef, dependency])
}

/**
 * Read-only review of the days that match the timeline filters. Days are rendered in
 * batches so a long history stays responsive.
 */
export default function TimelinePreview({ cards, sections, query, favoriteLookup, onToggleFavorite, onOpenDay }) {
  const fontSize = useMemo(readEditorFontSize, [])
  const sectionOrder = useMemo(() => new Map(sections.map((section, index) => [section.id, index])), [sections])
  const rootRef = useRef(null)

  // A different result set starts again from the top batch.
  const signature = `${cards.length}:${cards[0]?.dateStr ?? ''}:${cards[cards.length - 1]?.dateStr ?? ''}`
  const { visible, hasMore, remaining, sentinelRef, showMore } = useIncrementalList(cards, PAGE_SIZE, signature)

  useStuckHeaders(rootRef, visible.length)

  const summary = useMemo(() => {
    let entries = 0
    let words = 0
    for (const card of cards) {
      entries += card.sectionResults.length
      for (const result of card.sectionResults) {
        if (result.sec.type !== 'number') words += result.wordCount
      }
    }
    return { days: cards.length, entries, words }
  }, [cards])

  return (
    <div ref={rootRef} className="timeline-preview">
      <p className="preview-summary">
        共 <strong>{summary.days}</strong> 天 · <strong>{summary.entries}</strong> 条内容 · <strong>{summary.words}</strong> 字
      </p>
      {visible.map(card => (
        <DayBlock
          key={card.dateStr}
          card={card}
          sectionOrder={sectionOrder}
          query={query}
          favoriteLookup={favoriteLookup}
          onToggleFavorite={onToggleFavorite}
          onOpenDay={onOpenDay}
          fontSize={fontSize}
        />
      ))}
      {hasMore ? (
        <div ref={sentinelRef} className="preview-more">
          <button type="button" className="btn btn-ghost btn-sm" onClick={showMore}>
            显示更多（还有 {remaining} 天）
          </button>
        </div>
      ) : (
        <p className="preview-end">已到底部</p>
      )}
    </div>
  )
}
