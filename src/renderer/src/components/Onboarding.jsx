import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModalA11y } from '../utils/useModalA11y'
import GuideBlock from './guide/GuideBlock'
import { GUIDE_TOPICS, searchTopics } from './guide/guideTopics'
import './Onboarding.css'

// The in-app guide ("使用说明"): topics on the left, the open topic on the right, and a search
// that narrows the topics. It opens by itself on the first run and from the 💡 button / F1.
export default function Onboarding({ onDone, onOpenShortcuts, firstRun = false }) {
  const [topicId, setTopicId] = useState(GUIDE_TOPICS[0].id)
  const [query, setQuery] = useState('')
  const scrollRef = useRef(null)
  const navRef = useRef(null)

  const topics = useMemo(() => searchTopics(query), [query])
  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  const current = topics.find(topic => topic.id === topicId) || topics[0] || null
  const currentIndex = current ? topics.indexOf(current) : -1
  const previous = currentIndex > 0 ? topics[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < topics.length - 1 ? topics[currentIndex + 1] : null

  // A new topic starts at its top; the pane is focusable so the arrow and page keys scroll it.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [current?.id])

  // Esc first clears a search, then closes the guide. While the shortcut list is open on top of it,
  // that dialog (the newest one) gets Esc instead.
  const dialogRef = useRef(null)
  const dismiss = useCallback(() => {
    if (query) setQuery('')
    else onDone()
  }, [onDone, query])
  // Focus starts on the scrolling pane (`data-autofocus` below), and returns to the opener on close.
  useModalA11y(dialogRef, { onDismiss: dismiss })

  const selectTopic = useCallback((id) => setTopicId(id), [])

  const handleNavKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const target = topics[currentIndex + step]
    if (!target) return
    setTopicId(target.id)
    requestAnimationFrame(() => navRef.current?.querySelector(`[data-topic="${target.id}"]`)?.focus())
  }

  const actions = useMemo(() => ({ shortcuts: onOpenShortcuts }), [onOpenShortcuts])

  return (
    <div className="onboarding-overlay">
      <div ref={dialogRef} className="onboarding-modal guide" role="dialog" aria-modal="true" aria-label="使用说明">
        <aside className="guide-side">
          <div className="guide-brand">
            <span className="guide-brand-mark" aria-hidden="true">◈</span>
            <div>
              <h2 className="onboarding-title">使用说明</h2>
              <p className="guide-brand-sub">MotoTrace</p>
            </div>
          </div>

          <div className="guide-search">
            <span className="guide-search-icon" aria-hidden="true">⌕</span>
            <input
              className="input guide-search-input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索说明，如 表格"
              aria-label="搜索说明"
            />
            {query && (
              <button type="button" className="guide-search-clear" onClick={() => setQuery('')} title="清空搜索" aria-label="清空搜索">
                ×
              </button>
            )}
          </div>

          <nav
            className="guide-nav"
            role="tablist"
            aria-orientation="vertical"
            aria-label="说明主题"
            ref={navRef}
            onKeyDown={handleNavKeyDown}
          >
            {topics.map(topic => (
              <button
                key={topic.id}
                type="button"
                role="tab"
                id={`guide-tab-${topic.id}`}
                data-topic={topic.id}
                aria-selected={topic.id === current?.id}
                aria-controls="guide-panel"
                tabIndex={topic.id === current?.id ? 0 : -1}
                className={`guide-nav-item ${topic.id === current?.id ? 'active' : ''}`}
                onClick={() => selectTopic(topic.id)}
              >
                <span className="guide-nav-icon" aria-hidden="true">{topic.icon}</span>
                <span className="guide-nav-label">{topic.title}</span>
              </button>
            ))}
            {topics.length === 0 && <p className="guide-nav-empty">没有找到相关说明</p>}
          </nav>

          <p className="guide-side-hint"><kbd className="guide-kbd">F1</kbd> 随时打开本说明</p>
        </aside>

        <section className="guide-main">
          <header className="guide-main-head">
            {current ? (
              <div className="guide-main-title">
                <h3 className="onboarding-title guide-topic-title">{current.title}</h3>
                <p className="guide-topic-blurb">{current.blurb}</p>
              </div>
            ) : <div />}
            <button type="button" className="guide-close" onClick={onDone} title="关闭 (Esc)" aria-label="关闭">✕</button>
          </header>

          <div
            className="guide-scroll scrollable"
            id="guide-panel"
            role="tabpanel"
            aria-labelledby={current ? `guide-tab-${current.id}` : undefined}
            tabIndex={-1}
            data-autofocus
            ref={scrollRef}
          >
            {current ? (
              <div className="guide-article" key={current.id}>
                {current.blocks.map((block, index) => (
                  <GuideBlock key={index} block={block} words={words} actions={actions} />
                ))}
                <div className="guide-pager">
                  {previous ? (
                    <button type="button" className="guide-pager-btn" onClick={() => selectTopic(previous.id)}>
                      <span className="guide-pager-dir">← 上一篇</span>
                      <span className="guide-pager-title">{previous.title}</span>
                    </button>
                  ) : <span />}
                  {next ? (
                    <button type="button" className="guide-pager-btn is-next" onClick={() => selectTopic(next.id)}>
                      <span className="guide-pager-dir">下一篇 →</span>
                      <span className="guide-pager-title">{next.title}</span>
                    </button>
                  ) : <span />}
                </div>
              </div>
            ) : (
              <div className="guide-empty">
                <p>没有找到包含「{query}」的说明。</p>
                <p>换个关键词试试，例如：表格、快捷键、备份、便签。</p>
                <button type="button" className="guide-action" onClick={() => setQuery('')}>清空搜索</button>
              </div>
            )}
          </div>

          <footer className="guide-footer">
            <span className="guide-footer-hint">
              {current ? `${currentIndex + 1} / ${topics.length}` : ''}
            </span>
            <button type="button" className="btn btn-primary" onClick={onDone}>
              {firstRun ? '开始使用' : '关闭'}
            </button>
          </footer>
        </section>
      </div>
    </div>
  )
}
