import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { hasStoredValue, isEntryEmpty } from '../../utils/dayEntries'
import { buildFavoriteLookup, favoriteKey } from '../../utils/favorites'
import { isEditableMenuTarget, separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'

/**
 * Favourites and the right-click menu of a record card. Right-clicking text or an input keeps
 * the editing menu; anywhere else on a card opens this one.
 */
export function useSectionMenu({ dateStr, sections, getEntry, clearSection }) {
  const navigate = useNavigate()
  const { favorites, toggleFavorite, showToast } = useApp()

  const favoriteLookup = useMemo(() => buildFavoriteLookup(favorites), [favorites])
  const isFavorite = useCallback(
    (section) => favoriteLookup.has(favoriteKey(dateStr, section.id)),
    [favoriteLookup, dateStr]
  )

  const toggleSectionFavorite = useCallback((section) => {
    const favorite = isFavorite(section)
    if (!favorite && !hasStoredValue(getEntry(section.id))) {
      showToast('先记录一些内容再收藏', 'info', 1800)
      return
    }
    toggleFavorite(dateStr, section.id)
    showToast(favorite ? '已取消收藏' : '已收藏，可在时间线的「收藏」中查看', 'success', 1600)
  }, [dateStr, getEntry, isFavorite, showToast, toggleFavorite])

  const openSectionMenu = useCallback((event, section) => {
    if (isEditableMenuTarget(event.target)) return

    const hasContent = !isEntryEmpty(getEntry(section.id)?.value)
    // An optional section that is empty is just closed; with content, clearing asks first.
    const clearLabel = section.resident
      ? '清空'
      : (hasContent ? '清空并关闭板块' : '关闭板块')
    showContextMenu(event, [
      { id: 'favorite', label: isFavorite(section) ? '取消收藏' : '收藏' },
      separator,
      { id: 'clear', label: clearLabel, tone: 'danger' },
      separator,
      { id: 'edit-settings', label: '在设置中编辑' }
    ], {
      scope: 'today-section',
      sectionId: section.id
    })
  }, [getEntry, isFavorite])

  useContextMenuCommand('today-section', useCallback((id, context) => {
    if (!context?.sectionId) return
    if (id === 'favorite') {
      const target = sections.find(item => item.id === context.sectionId)
      if (target) toggleSectionFavorite(target)
    } else if (id === 'clear') {
      clearSection(context.sectionId)
    } else if (id === 'edit-settings') {
      navigate('/settings')
    }
  }, [clearSection, toggleSectionFavorite, navigate, sections]))

  return { isFavorite, toggleSectionFavorite, openSectionMenu }
}
