import { createContext, useContext, useEffect, useState } from 'react'
import { useAppearance } from './useAppearance'
import { useConfirmDialog } from './useConfirmDialog'
import { useDayStorage } from './useDayStorage'
import { useEditorTypesetting } from './useEditorTypesetting'
import { useMetadata } from './useMetadata'
import { usePendingFlushes } from './usePendingFlushes'
import { useSections } from './useSections'
import { useToasts } from './useToasts'

const AppContext = createContext(null)

/**
 * The app-wide state, one hook per concern (appearance, typesetting, sections, day storage,
 * metadata, toasts, the confirm dialog, flush-before-close), merged into the single `useApp()`
 * value the pages use. Startup loads them in order and then marks the app initialized.
 */
export function AppProvider({ children }) {
  const [dataDir, setDataDir] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())

  const { toasts, showToast } = useToasts()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const flushes = usePendingFlushes({ showToast })
  const appearance = useAppearance()
  const typesetting = useEditorTypesetting()
  const sectionsStore = useSections({ showToast })
  const dayStorage = useDayStorage()
  const metadata = useMetadata(flushes)

  const { loadAppearance } = appearance
  const { loadTypesetting } = typesetting
  const { loadSections } = sectionsStore
  const { refreshDates } = dayStorage
  const { loadMetadata } = metadata

  useEffect(() => {
    async function init() {
      try {
        const config = await window.api.config.get()
        await loadAppearance(config)
        loadTypesetting(config)
        setDataDir(await window.api.config.getDataDir())

        await loadSections()
        await refreshDates()
        if (!await loadMetadata()) {
          showToast('图表、倒数日等配置无法读取，已暂用空配置。原文件在被覆盖前会存入自动历史，可在「设置 → 数据与备份 → 查看自动历史」中找回。', 'error', 9000)
        }
        setIsInitialized(true)
      } catch (error) {
        console.error('Init error:', error)
        setIsInitialized(true)
      }
    }
    init()
  }, [loadAppearance, loadTypesetting, loadSections, refreshDates, loadMetadata, showToast])

  const value = {
    ...appearance,
    ...typesetting,
    sections: sectionsStore.sections,
    setSections: sectionsStore.setSections,
    loadSections,
    saveSections: sectionsStore.saveSections,
    ...dayStorage,
    toasts, showToast,
    dataDir, setDataDir,
    isInitialized,
    selectedDate, setSelectedDate,
    countdowns: metadata.countdowns, saveCountdowns: metadata.saveCountdowns,
    analytics: metadata.analytics, saveAnalytics: metadata.saveAnalytics,
    favorites: metadata.favorites, toggleFavorite: metadata.toggleFavorite,
    reloadMetadata: loadMetadata,
    confirm,
    ...flushes
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      {confirmDialog}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
