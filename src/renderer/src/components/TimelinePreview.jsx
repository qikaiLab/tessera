import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import RichTextView from './RichTextView'
import { favoriteKey } from '../utils/favorites'
import { readEditorFontSize } from '../utils/editorFontSize'
import { useIncrementalList } from '../utils/useIncrementalList'
import './TimelinePreview.css'

const PAGE_SIZE = 12

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

// A day shows about this many lines of its text; more is folded away until asked for.
const CLAMP_LINES = 6
// Fewer extra lines than this are not worth a fold: "about six lines" includes a seventh.
const CLAMP_MIN_LINES = 8
// Breathing room below the last visible line, inside the fade.
const CLAMP_SLACK = 14

// The vertical extent of every visual line of text under `root`, top to bottom, measured from
// the top of `root` (paragraph spacing, lists and wrapped lines are all just lines).
function measureTextLines(root) {
  const base = root.getBoundingClientRect().top
  const rects = []
  const range = document.createRange()
  for (const rich of root.querySelectorAll('.rich-view')) {
    const walker = document.createTreeWalker(rich, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.trim()) continue
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.height > 0) rects.push({ top: rect.top - base, bottom: rect.bottom - base })
      }
    }
  }
  rects.sort((a, b) => a.top - b.top)
  const lines = []
  for (const rect of rects) {
    const last = lines[lines.length - 1]
    // A rect that mostly sits inside the previous line belongs to it (bold runs, links, code).
    if (last && rect.top < last.bottom - (rect.bottom - rect.top) * 0.5) {
      last.bottom = Math.max(last.bottom, rect.bottom)
    } else {
      lines.push({ ...rect })
    }
  }
  return lines
}

function ClampedBody({ children, startOpen, label }) {
  const bodyRef = useRef(null)
  const innerRef = useRef(null)
  const [overflowing, setOverflowing] = useState(false)
  const [expanded, setExpanded] = useState(startOpen)
  const expandedRef = useRef(startOpen)
  const settleTimerRef = useRef(null)

  // Height of the folded state (the bottom of the sixth line of text), and the natural height.
  const measure = useCallback(() => {
    const inner = innerRef.current
    if (!inner) return null
    const natural = inner.scrollHeight
    const lines = measureTextLines(inner)
    if (lines.length < CLAMP_MIN_LINES) return { overflowing: false, clamp: 0, natural }
    const clamp = Math.round(lines[CLAMP_LINES - 1].bottom + CLAMP_SLACK)
    return { overflowing: natural > clamp + CLAMP_SLACK, clamp, natural }
  }, [])

  const apply = useCallback(() => {
    const body = bodyRef.current
    const result = measure()
    if (!body || !result) return
    setOverflowing(result.overflowing)
    if (!result.overflowing) {
      body.style.height = ''
    } else if (!expandedRef.current) {
      body.style.height = `${result.clamp}px`
    }
  }, [measure])

  useLayoutEffect(() => {
    apply()
    const inner = innerRef.current
    if (!inner || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(apply)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [apply])

  useEffect(() => () => clearTimeout(settleTimerRef.current), [])

  const toggle = useCallback(() => {
    const body = bodyRef.current
    const result = measure()
    if (!body || !result) return
    clearTimeout(settleTimerRef.current)
    const next = !expandedRef.current
    expandedRef.current = next
    setExpanded(next)
    // Start from the height the card has right now, then move to the other one.
    body.style.height = `${body.getBoundingClientRect().height}px`
    void body.offsetHeight
    if (next) {
      body.style.height = `${result.natural}px`
      // Back to `auto` once open (also when no transition runs, e.g. reduced motion).
      settleTimerRef.current = setTimeout(() => { body.style.height = '' }, 420)
    } else {
      body.style.height = `${result.clamp}px`
    }
  }, [measure])

  // Searching opens the days it finds text in, so the highlighted matches are not folded away.
  useEffect(() => {
    if (startOpen && overflowing && !expandedRef.current) toggle()
  }, [startOpen, overflowing, toggle])

  return (
    <>
      <div ref={bodyRef} className={`preview-day-body${overflowing && !expanded ? ' is-clamped' : ''}`}>
        <div ref={innerRef}>{children}</div>
      </div>
      {overflowing && (
        <button
          type="button"
          className="preview-day-toggle"
          aria-expanded={expanded}
          aria-label={`${expanded ? '收起' : '展开'}${label}的全部内容`}
          onClick={toggle}
        >
          {expanded ? '收起' : '展开全部'}
          <span className="preview-day-toggle-chevron" aria-hidden="true">▾</span>
        </button>
      )}
    </>
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

      <ClampedBody startOpen={Boolean(query)} label={format(date, 'MM月dd日')}>
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
      </ClampedBody>
    </section>
  )
}

/**
 * Read-only review of the days that match the timeline filters. Days are rendered in
 * batches so a long history stays responsive.
 */
export default function TimelinePreview({ cards, sections, query, favoriteLookup, onToggleFavorite, onOpenDay }) {
  const fontSize = useMemo(readEditorFontSize, [])
  const sectionOrder = useMemo(() => new Map(sections.map((section, index) => [section.id, index])), [sections])

  // A different result set starts again from the top batch.
  const signature = `${cards.length}:${cards[0]?.dateStr ?? ''}:${cards[cards.length - 1]?.dateStr ?? ''}`
  const { visible, hasMore, remaining, sentinelRef, showMore } = useIncrementalList(cards, PAGE_SIZE, signature)

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
    <div className="timeline-preview">
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
