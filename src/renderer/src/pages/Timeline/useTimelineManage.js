import { useState } from 'react'
import { useApp } from '../../context/AppContext'

const dayFile = (dateStr) => {
  const [year, month, day] = dateStr.split('-')
  return `${year}/${month}/${day}.json`
}

/**
 * Management mode of the list view: pick days and delete them (whole days, or only the sections
 * selected in the filter). Deleting asks first; what is removed is kept in the automatic history.
 */
export function useTimelineManage({ cards, filterSections, loadedDates, setLoading }) {
  const { sections, writeDayData, refreshDates, confirm, showToast } = useApp()
  const [isManageMode, setIsManageMode] = useState(false)
  const [selectedDates, setSelectedDates] = useState(() => new Set())

  const leaveManageMode = () => {
    setIsManageMode(false)
    setSelectedDates(new Set())
  }

  const toggleManageMode = () => {
    setIsManageMode(on => !on)
    setSelectedDates(new Set())
  }

  const toggleSelected = (dateStr) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (!next.delete(dateStr)) next.add(dateStr)
      return next
    })
  }

  // Only days the list shows right now count: a day ticked earlier and since hidden by a filter
  // is neither counted, nor confirmed, nor deleted.
  const visibleDates = new Set(cards.map(card => card.dateStr))
  const targetDates = [...selectedDates].filter(dateStr => visibleDates.has(dateStr))

  const toggleSelectAll = () => {
    setSelectedDates(targetDates.length === cards.length ? new Set() : new Set(cards.map(card => card.dateStr)))
  }

  const deleteSelected = async () => {
    if (targetDates.length === 0) return
    const count = targetDates.length
    const clearedNames = filterSections
      .map(id => sections.find(section => section.id === id))
      .filter(Boolean)
      .map(section => `「${section.name}」`)
      .join('、')
    const wholeDays = filterSections.length === 0

    const confirmed = await confirm(wholeDays
      ? {
          message: `确定要删除所选的这 ${count} 天的全部记录吗？\n这些日期的记录文件会被移除；删除前的内容会存入自动历史，之后可在「设置 → 数据与备份 → 查看自动历史」中恢复。`,
          title: '确认删除',
          confirmText: '确定删除',
          danger: true
        }
      : {
          message: `确定要清除所选这 ${count} 天的${clearedNames}版块数据吗？\n其他版块的内容将会被保留；清除前的内容会存入自动历史，可在「设置 → 数据与备份 → 查看自动历史」中恢复。`,
          title: '确认清除版块',
          confirmText: '确定清除',
          danger: true
        })
    if (!confirmed) return

    setLoading(true)
    try {
      const results = await Promise.all(targetDates.map(async (dateStr) => {
        let result
        if (wholeDays) {
          result = await window.api.fs.deleteFile(dayFile(dateStr))
        } else {
          // Writing the day without those sections also removes its file when nothing is left.
          const remaining = { ...(loadedDates[dateStr] || {}) }
          for (const id of filterSections) delete remaining[id]
          result = await writeDayData(dateStr, remaining)
        }
        return { dateStr, ok: Boolean(result?.ok) }
      }))
      const failed = results.filter(result => !result.ok)
      await refreshDates()
      if (failed.length === 0) {
        showToast(wholeDays ? `成功删除 ${count} 天的记录` : `成功清除 ${count} 天的${clearedNames}数据`, 'success')
        leaveManageMode()
      } else {
        // Keep the days that could not be changed selected, so the user sees which and can retry.
        setSelectedDates(new Set(failed.map(result => result.dateStr)))
        showToast(`有 ${failed.length} 天没能${wholeDays ? '删除' : '清除'}（如 ${failed[0].dateStr}），其余 ${count - failed.length} 天已处理`, 'error', 8000)
      }
    } catch (error) {
      console.error(error)
      showToast('删除失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return { isManageMode, selectedDates: new Set(targetDates), leaveManageMode, toggleManageMode, toggleSelected, toggleSelectAll, deleteSelected }
}
