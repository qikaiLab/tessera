import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isToday, parseISO } from 'date-fns'
import { useApp } from '../../context/AppContext'
import { isEntryEmpty, isSectionAddable, isSectionClosable, isSectionOnDay } from '../../utils/dayEntries'

// Matches the slotShrink animation in SectionCard.css.
const REMOVE_SECTION_MS = 380

/**
 * Which sections are on screen for the day, and how optional ("activated") ones come and go.
 *
 * - Resident sections are always there; an optional one appears once it holds something or
 *   when the user adds it from "add record" (nothing is stored by adding alone).
 * - A section that was just added grows into place (`addedSectionId`).
 * - A closed or cleared section stays on screen with the value it had while it folds away
 *   (`leavingSections`), and its data is dropped at once.
 */
export function useSectionPresence({ dateStr, sections, data, numberDefaults, getEntry, removeEntry }) {
  const { confirm, showToast } = useApp()
  const [manuallyAdded, setManuallyAdded] = useState(() => new Set())
  const [addedSectionId, setAddedSectionId] = useState(null)
  const [leavingSections, setLeavingSections] = useState({})
  const leaveTimersRef = useRef(new Map())

  // Each day starts with nothing added by hand and nothing folding away.
  useEffect(() => {
    setManuallyAdded(new Set())
    setAddedSectionId(null)
    setLeavingSections({})
  }, [dateStr])

  useEffect(() => {
    const timers = leaveTimersRef.current
    return () => timers.forEach(timer => clearTimeout(timer))
  }, [])

  const isLeaving = useCallback((sectionId) => leavingSections[sectionId] !== undefined, [leavingSections])

  const visibleSections = useMemo(() => sections.filter(section => isSectionOnDay(
    section,
    data[section.id],
    { added: manuallyAdded.has(section.id), leaving: leavingSections[section.id] !== undefined }
  )), [sections, data, manuallyAdded, leavingSections])

  const availableToAdd = useMemo(() => sections.filter(
    section => isSectionAddable(section, data[section.id], manuallyAdded.has(section.id))
  ), [sections, data, manuallyAdded])

  // What a section shows: what it held while folding away, else what is stored, else (for
  // numbers) its default.
  const getDisplayValue = useCallback((section) => {
    if (leavingSections[section.id] !== undefined) return leavingSections[section.id]
    const stored = data[section.id]?.value
    if (stored !== undefined && stored !== null) return stored
    if (section.type === 'number') return numberDefaults[section.id] ?? '0'
    return ''
  }, [data, numberDefaults, leavingSections])

  const addSection = useCallback((sectionId) => {
    setManuallyAdded(prev => new Set([...prev, sectionId]))
    setAddedSectionId(sectionId)
  }, [])

  const finishAdding = useCallback((sectionId) => {
    setAddedSectionId(current => (current === sectionId ? null : current))
  }, [])

  // Drops the day's data for an optional section and lets it fold away.
  const retireSection = useCallback((section) => {
    const sectionId = section.id
    const heldValue = getDisplayValue(section)
    removeEntry(sectionId)
    setManuallyAdded(prev => {
      if (!prev.has(sectionId)) return prev
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
    setLeavingSections(prev => ({ ...prev, [sectionId]: heldValue }))
    clearTimeout(leaveTimersRef.current.get(sectionId))
    leaveTimersRef.current.set(sectionId, setTimeout(() => {
      leaveTimersRef.current.delete(sectionId)
      setLeavingSections(prev => {
        const next = { ...prev }
        delete next[sectionId]
        return next
      })
    }, REMOVE_SECTION_MS))
  }, [getDisplayValue, removeEntry])

  // Closing an optional section that holds nothing needs no confirmation.
  const closeSection = retireSection

  // Clearing a section that holds something asks first: a misclick must not wipe a long text.
  const clearSection = useCallback(async (sectionId) => {
    const section = sections.find(item => item.id === sectionId)
    if (!section) return
    if (!isEntryEmpty(getEntry(sectionId)?.value)) {
      const confirmed = await confirm({
        title: section.resident ? '清空记录' : '清空并关闭板块',
        message: `确定要清空「${section.name}」${isToday(parseISO(dateStr)) ? '今天' : '这一天'}的记录吗？\n清空后内容无法恢复。`,
        confirmText: '清空',
        cancelText: '取消',
        danger: true
      })
      if (!confirmed) return
    }
    if (section.resident) removeEntry(sectionId)
    else retireSection(section)
    showToast(section.resident ? '已清空记录' : '已清空并关闭板块', 'success', 1200)
  }, [sections, dateStr, getEntry, confirm, removeEntry, retireSection, showToast])

  const isClosable = useCallback(
    (section) => !isLeaving(section.id) && isSectionClosable(section, data[section.id]),
    [data, isLeaving]
  )

  return {
    visibleSections,
    availableToAdd,
    addedSectionId,
    manuallyAdded,
    isLeaving,
    isClosable,
    getDisplayValue,
    addSection,
    finishAdding,
    closeSection,
    clearSection
  }
}
