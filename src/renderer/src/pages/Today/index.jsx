import { useRef } from 'react'
import { format } from 'date-fns'
import { useApp } from '../../context/AppContext'
import NotesDrawer from '../../components/NotesDrawer'
import AddSectionRow from './AddSectionRow'
import SectionCard from './SectionCard'
import TodayHeader from './TodayHeader'
import { useBackToTop } from './useBackToTop'
import { useCollapsedCards } from './useCollapsedCards'
import { useDateNavigation } from './useDateNavigation'
import { useDayRecords } from './useDayRecords'
import { useFollowAddedSection } from './useFollowAddedSection'
import { useNotesDrawer } from './useNotesDrawer'
import { useSectionFullscreen } from './useSectionFullscreen'
import { useSectionMenu } from './useSectionMenu'
import { useSectionPresence } from './useSectionPresence'
import './Today.css'

function SkeletonCards() {
  return (
    <div className="today-skeleton">
      {[1, 2].map(i => (
        <div key={i} className="skeleton-card">
          <div className="skeleton" style={{ height: 20, width: '30%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      ))}
    </div>
  )
}

// The day's file is there but could not be read: nothing is offered to type into, since saving would
// replace it. The file itself was not touched.
function DayReadError({ message, onRetry }) {
  return (
    <div className="today-empty-day" role="alert">
      <div className="empty-state">
        <span className="empty-state-icon">⚠</span>
        <p className="empty-state-title">这天的记录暂时无法读取</p>
        <p className="empty-state-desc">{message}。为避免覆盖，这一天暂不可编辑，原文件没有被改动。可以重试；若文件确已损坏，可在「设置 → 数据与备份 → 查看自动历史」中找回。</p>
        <button className="btn btn-secondary" onClick={onRetry}>重试读取</button>
      </div>
    </div>
  )
}

function EmptyDay() {
  return (
    <div className="today-empty-day">
      <div className="empty-state">
        <span className="empty-state-icon">📋</span>
        <p className="empty-state-title">这天还没有记录</p>
        <p className="empty-state-desc">所有常驻版块已显示，点击下方「+」添加非常驻版块的记录</p>
      </div>
    </div>
  )
}

// The record page: one day's section cards, day navigation and the notes drawer. The state is
// split by concern into the hooks next to this file; this component only wires them together.
export default function Today() {
  const { sections, selectedDate, setSelectedDate, showToast } = useApp()
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const contentRef = useRef(null)

  const records = useDayRecords({ dateStr, sections })
  const presence = useSectionPresence({
    dateStr,
    sections,
    data: records.data,
    numberDefaults: records.numberDefaults,
    getEntry: records.getEntry,
    removeEntry: records.removeEntry
  })
  const navigation = useDateNavigation({
    selectedDate,
    setSelectedDate,
    flushDay: records.flushNow,
    onSaveFailed: records.reportSaveFailed
  })
  const menu = useSectionMenu({
    dateStr,
    sections,
    getEntry: records.getEntry,
    clearSection: presence.clearSection
  })
  const fullscreen = useSectionFullscreen(dateStr)
  const collapsedCards = useCollapsedCards(dateStr)
  const notesDrawer = useNotesDrawer()
  const backToTop = useBackToTop(contentRef)
  useFollowAddedSection(contentRef, presence.addedSectionId, presence.finishAdding)

  // The new card is ready to type into: put the caret in it without scrolling again.
  const focusAddedSection = (sectionId) => {
    const slot = contentRef.current?.querySelector(`[data-section-slot="${CSS.escape(sectionId)}"]`)
    slot?.querySelector('.ProseMirror, input, textarea')?.focus({ preventScroll: true })
  }

  const renderContent = () => {
    if (records.holding) return null
    if (records.loading) return records.showSkeleton ? <SkeletonCards /> : <div className="today-loading-quiet" />
    if (records.loadError) return <DayReadError message={records.loadError} onRetry={records.retryLoad} />
    if (presence.visibleSections.length === 0 && sections.length > 0) return <EmptyDay />
    return (
      <div key={`sections-${dateStr}`} className="sections-grid">
        {presence.visibleSections.map((section, index) => {
          const leaving = presence.isLeaving(section.id)
          const adding = presence.addedSectionId === section.id
          return (
            <div
              key={section.id}
              data-section-slot={section.id}
              className={`section-slot ${adding ? 'is-adding' : ''} ${presence.manuallyAdded.has(section.id) ? 'was-added' : ''} ${leaving ? 'is-removing' : ''}`}
              inert={leaving ? '' : undefined}
              onAnimationEnd={event => {
                if (event.target === event.currentTarget && adding) focusAddedSection(section.id)
              }}
            >
              <SectionCard
                section={section}
                value={presence.getDisplayValue(section)}
                valuePending={records.carryPending.has(section.id)}
                onChange={(value) => records.changeValue(section.id, value)}
                onContextMenu={(event) => menu.openSectionMenu(event, section)}
                onUseRecentNumberValue={() => records.findRecentNumberValue(dateStr, section.id)}
                showToast={showToast}
                animationDelay={Math.min(index, 5) * 40}
                dateTransitionDir={navigation.dateTransitionDir}
                isFullScreen={fullscreen.fullScreenSectionId === section.id}
                favorite={menu.isFavorite(section)}
                onToggleFavorite={() => menu.toggleSectionFavorite(section)}
                closable={presence.isClosable(section)}
                onClose={() => presence.closeSection(section)}
                collapsed={collapsedCards.isCollapsed(section.id)}
                onToggleCollapsed={() => collapsedCards.toggleCollapsed(section.id)}
                onToggleFullScreen={() => fullscreen.toggleFullscreen(section.id)}
                onSave={records.saveNow}
              />
            </div>
          )
        })}
      </div>
    )
  }

  const fullscreenActive = Boolean(fullscreen.fullScreenSectionId)

  return (
    <div className="today-page">
      <div className={`today-main-split ${notesDrawer.mounted ? 'has-notes-drawer' : ''}`}>
        <div className="today-record-pane">
          <TodayHeader
            selectedDate={selectedDate}
            dateStr={dateStr}
            dateTransitionDir={navigation.dateTransitionDir}
            returnTodayPhase={navigation.returnTodayPhase}
            onGo={navigation.goTo}
            onReturnToToday={navigation.returnToToday}
            notesDrawerOpen={notesDrawer.open}
            onToggleNotesDrawer={notesDrawer.toggle}
            saveStatus={records.saveStatus}
          />

          <div
            ref={contentRef}
            onScroll={backToTop.handleScroll}
            className={`today-content ${navigation.dateLeaving ? `is-date-leaving date-leaving-${navigation.dateLeavingDir}` : ''}`}
          >
            {renderContent()}
            {!records.holding && <AddSectionRow sections={presence.availableToAdd} onAdd={presence.addSection} />}
          </div>
          <button
            type="button"
            className={`back-to-top-btn ${backToTop.visible && !fullscreenActive ? 'is-visible' : ''}`}
            onClick={backToTop.scrollToTop}
            title="回到顶端"
            aria-label="回到顶端"
            tabIndex={backToTop.visible && !fullscreenActive ? 0 : -1}
          >
            ↑
          </button>
        </div>
        {notesDrawer.mounted && (
          <NotesDrawer
            dateStr={dateStr}
            width={notesDrawer.width}
            onResizeStart={notesDrawer.startResize}
            closing={!notesDrawer.open}
            suspended={fullscreenActive}
            onAnimationEnd={notesDrawer.handleAnimationEnd}
          />
        )}
      </div>
    </div>
  )
}
