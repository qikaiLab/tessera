import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { flushSaveCallbacks } from '../utils/pendingSaves'
import {
  INTERFACE_STYLE_IDS,
  THEME_ACCENT_IDS,
  applyAppearanceToRoot,
  isThemeToggleAvailable,
  normalizeInterfaceStyleId,
  normalizeTheme,
  normalizeThemeAccentId
} from '../theme/appearanceRegistry'
import { applyFrostedGlassBackground } from '../theme/frostedGlassBackground'
import { buildMetadataContent, normalizeFavorites, toggleFavoriteEntry } from '../utils/favorites'
import {
  FROSTED_BACKGROUND_BLUR,
  applyFrostedBackgroundBlur,
  normalizeFrostedBackgroundBlur
} from '../theme/frostedGlassPreferences'
import {
  INTERFACE_FONT_IDS,
  INTERFACE_WEIGHT_IDS,
  INTERFACE_ZOOM,
  applyInterfacePreferencesToRoot,
  normalizeInterfaceFontId,
  normalizeInterfaceWeightId,
  normalizeInterfaceZoom
} from '../theme/interfacePreferences'

const AppContext = createContext(null)

const isEntryEmpty = (val) => {
  if (val === undefined || val === null) return true
  const str = String(val).trim()
  if (str === '') return true
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const doc = JSON.parse(str)
      if (doc.type === 'doc') {
        const hasContent = (node) => {
          if (!node) return false
          if (node.type === 'text' && node.text && node.text.trim() !== '') return true
          if (node.content && Array.isArray(node.content)) {
            return node.content.some(hasContent)
          }
          return false
        }
        return !hasContent(doc)
      }
    } catch {}
  }
  return false
}

export function AppProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [interfaceStyle, setInterfaceStyle] = useState(INTERFACE_STYLE_IDS.DEFAULT)
  const [themeAccent, setThemeAccent] = useState(THEME_ACCENT_IDS.VIOLET)
  const [frostedBackgroundUrl, setFrostedBackgroundUrl] = useState(null)
  const [frostedBackgroundBlur, setFrostedBackgroundBlur] = useState(FROSTED_BACKGROUND_BLUR.DEFAULT)
  const [interfaceZoom, setInterfaceZoom] = useState(INTERFACE_ZOOM.DEFAULT)
  const [interfaceFont, setInterfaceFont] = useState(INTERFACE_FONT_IDS.THEME)
  const [interfaceWeight, setInterfaceWeight] = useState(INTERFACE_WEIGHT_IDS.STANDARD)
  const [sections, setSections] = useState([])
  const [datesWithData, setDatesWithData] = useState([])
  const [toasts, setToasts] = useState([])
  const [dataDir, setDataDir] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Typesetting Settings
  const [fullscreenWidthMode, setFullscreenWidthMode] = useState('standard')
  const [fullscreenStandardWidth, setFullscreenStandardWidth] = useState('700px')
  const [fullscreenWideWidth, setFullscreenWideWidth] = useState('1000px')
  const [editorLineHeight, setEditorLineHeight] = useState('1.8')
  const [editorLetterSpacing, setEditorLetterSpacing] = useState('0px')

  // Metadata Settings (Countdowns and Charts)
  const [countdowns, setCountdowns] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [favorites, setFavorites] = useState([])
  const metadataTimerRef = useRef(null)
  const hasChangedRef = useRef(false)
  // Fix #7: Write lock to prevent concurrent metadata writes
  const isWritingMetadataRef = useRef(false)
  const metadataWriteRef = useRef(Promise.resolve())
  const needsRewriteRef = useRef(false)

  // Fix #8: Registry of pending flush callbacks for graceful shutdown
  const pendingFlushesRef = useRef(new Map())
  const interfaceZoomRef = useRef(INTERFACE_ZOOM.DEFAULT)

  const registerPendingFlush = useCallback((key, flushFn) => {
    pendingFlushesRef.current.set(key, flushFn)
  }, [])

  const unregisterPendingFlush = useCallback((key) => {
    pendingFlushesRef.current.delete(key)
  }, [])

  const loadMetadata = useCallback(async () => {
    const res = await window.api.metadata.get()
    if (res.ok) {
      try {
        const meta = JSON.parse(res.data)
        let cds = meta.countdowns || []
        let charts = meta.analytics || []
        
        // Migration from localStorage if metadata is empty but localStorage has data
        let migrated = false
        if (cds.length === 0) {
          const localCdsStr = localStorage.getItem('mototrace_countdowns')
          if (localCdsStr) {
            try {
              const localCds = JSON.parse(localCdsStr)
              if (Array.isArray(localCds) && localCds.length > 0) {
                cds = localCds
                migrated = true
              }
            } catch {}
          }
        }
        
        if (charts.length === 0) {
          const localChartsStr = localStorage.getItem('mototrace_analytics')
          if (localChartsStr) {
            try {
              const localCharts = JSON.parse(localChartsStr)
              if (Array.isArray(localCharts) && localCharts.length > 0) {
                charts = localCharts
                migrated = true
              }
            } catch {}
          }
        }

        setCountdowns(cds)
        setAnalytics(charts)
        setFavorites(normalizeFavorites(meta.favorites))

        if (migrated) {
          // Write back migrated data to metadata.json and clean up localStorage
          await window.api.metadata.set(buildMetadataContent({ countdowns: cds, analytics: charts, favorites: meta.favorites }))
          localStorage.removeItem('mototrace_countdowns')
          localStorage.removeItem('mototrace_analytics')
        }
        return true
      } catch (e) {
        console.error('Failed to parse metadata.json:', e)
        return false
      }
    }
    return false
  }, [])

  const saveCountdowns = useCallback((cds) => {
    hasChangedRef.current = true
    setCountdowns(cds)
  }, [])

  const saveAnalytics = useCallback((cards) => {
    hasChangedRef.current = true
    setAnalytics(cards)
  }, [])

  const toggleFavorite = useCallback((dateStr, sectionId) => {
    hasChangedRef.current = true
    setFavorites(prev => toggleFavoriteEntry(prev, dateStr, sectionId))
  }, [])

  // Fix #7: Debounced metadata save with write lock to prevent race conditions
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, leaving: false }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    }, duration)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration + 220)
  }, [])

  const doMetadataWrite = useCallback(async () => {
    if (isWritingMetadataRef.current) {
      // A write is in progress — mark that we need to re-write when done
      needsRewriteRef.current = true
      return
    }
    isWritingMetadataRef.current = true
    try {
      // Read latest state via functional setters' closure would be stale here,
      // so we rely on the fact that React state is committed before setTimeout fires
      const content = buildMetadataContent({ countdowns, analytics, favorites })
      metadataWriteRef.current = window.api.metadata.set(content)
      const result = await metadataWriteRef.current
      if (!result.ok) hasChangedRef.current = true
    } catch (e) {
      hasChangedRef.current = true
      console.error('Failed to write metadata:', e)
    } finally {
      isWritingMetadataRef.current = false
      // If new changes came in during write, flush again
      if (needsRewriteRef.current) {
        needsRewriteRef.current = false
        // Schedule next write on next tick to get latest state
        setTimeout(() => {
          if (hasChangedRef.current) {
            hasChangedRef.current = false
            doMetadataWrite()
          }
        }, 50)
      }
    }
  }, [countdowns, analytics, favorites])

  useEffect(() => {
    if (!hasChangedRef.current) return

    if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current)
    metadataTimerRef.current = setTimeout(() => {
      hasChangedRef.current = false
      doMetadataWrite()
    }, 300)

    return () => {
      if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current)
    }
  }, [countdowns, analytics, favorites, doMetadataWrite])

  // Fix #8: Register metadata flush for graceful shutdown
  useEffect(() => {
    const flushMetadata = async () => {
      try { await metadataWriteRef.current } catch { hasChangedRef.current = true }
      if (metadataTimerRef.current) {
        clearTimeout(metadataTimerRef.current)
        metadataTimerRef.current = null
      }
      if (hasChangedRef.current || needsRewriteRef.current) {
        hasChangedRef.current = false
        needsRewriteRef.current = false
        const content = buildMetadataContent({ countdowns, analytics, favorites })
        const result = await window.api.metadata.set(content)
        if (!result.ok) {
          hasChangedRef.current = true
          return false
        }
      }
    }
    registerPendingFlush('metadata', flushMetadata)
    return () => unregisterPendingFlush('metadata')
  }, [countdowns, analytics, favorites, registerPendingFlush, unregisterPendingFlush])

  const flushPendingSaves = useCallback(async () => {
    return flushSaveCallbacks(pendingFlushesRef.current.values())
  }, [])

  // Fix #8: Listen for app-before-close and flush all pending saves
  useEffect(() => {
    const cleanup = window.api.lifecycle.onBeforeClose(async () => {
      if (!await flushPendingSaves()) {
        await window.api.lifecycle.cancelClose()
        showToast('保存失败，已取消退出。请重试保存，或先复制未保存的内容。', 'error')
        return
      }
      // Tell main process it's safe to close now
      window.api.lifecycle.confirmClose()
    })
    return cleanup
  }, [flushPendingSaves, showToast])

  const saveSectionsData = useCallback(async (secs) => {
    await window.api.fs.writeFile('sections.json', JSON.stringify(secs, null, 2))
  }, [])

  const loadSections = useCallback(async () => {
    const defaults = [
      { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
      { id: 'running', name: '今日跑步[m]', type: 'number', unit: 'm', resident: false, order: 1 }
    ]
    const result = await window.api.fs.readFile('sections.json')
    if (result.ok) {
      try {
        const parsed = JSON.parse(result.data)
        if (!Array.isArray(parsed)) throw new Error('sections.json is not a list')
        setSections(parsed)
        return parsed
      } catch (e) {
        console.error('Failed to parse sections.json:', e)
        // Never overwrite a file that exists but cannot be understood: keep it on disk
        // and run on the defaults in memory until the user edits their sections.
        setSections(defaults)
        showToast('版块配置文件无法读取，已临时使用默认版块。原文件未被改动，可在「设置 → 数据与备份 → 查看自动历史」中找回。', 'error', 8000)
        return defaults
      }
    }
    // Only a missing file means "first run"; any other read failure must not clobber it.
    if (!/ENOENT/.test(result.error || '')) {
      setSections(defaults)
      showToast('读取版块配置失败，已临时使用默认版块，未改动原文件。', 'error', 6000)
      return defaults
    }
    await saveSectionsData(defaults)
    setSections(defaults)
    return defaults
  }, [saveSectionsData, showToast])

  const saveSections = useCallback(async (secs) => {
    setSections(secs)
    await saveSectionsData(secs)
  }, [saveSectionsData])


  const toggleTheme = useCallback(() => {
    if (!isThemeToggleAvailable(interfaceStyle)) return
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyAppearanceToRoot(document.documentElement, { interfaceStyle, theme: next, themeAccent })
    window.api.config.set('theme', next)
  }, [interfaceStyle, theme, themeAccent])

  const updateInterfaceStyle = useCallback((value) => {
    const next = normalizeInterfaceStyleId(value)
    setInterfaceStyle(next)
    applyAppearanceToRoot(document.documentElement, { interfaceStyle: next, theme, themeAccent })
    window.api.config.set('interfaceStyle', next)
  }, [theme, themeAccent])

  const importFrostedBackground = useCallback(async () => {
    const result = await window.api.appearanceBackground.import()
    if (result.ok && !result.canceled && result.background?.dataUrl) {
      setFrostedBackgroundUrl(result.background.dataUrl)
      await applyFrostedGlassBackground(document.documentElement, result.background.dataUrl)
    }
    return result
  }, [])

  const clearFrostedBackground = useCallback(async () => {
    const result = await window.api.appearanceBackground.clear()
    if (result.ok) {
      setFrostedBackgroundUrl(null)
      await applyFrostedGlassBackground(document.documentElement)
    }
    return result
  }, [])

  const updateFrostedBackgroundBlur = useCallback((value) => {
    const next = applyFrostedBackgroundBlur(document.documentElement, value)
    setFrostedBackgroundBlur(next)
    window.api.config.set('frostedBackgroundBlur', next)
  }, [])

  const updateThemeAccent = useCallback((value) => {
    const next = normalizeThemeAccentId(value)
    setThemeAccent(next)
    applyAppearanceToRoot(document.documentElement, { interfaceStyle, theme, themeAccent: next })
    window.api.config.set('themeAccent', next)
  }, [interfaceStyle, theme])

  const updateInterfaceZoom = useCallback((value) => {
    const next = normalizeInterfaceZoom(value)
    interfaceZoomRef.current = next
    setInterfaceZoom(next)
    window.api.zoom.setFactor(next / 100)
    window.api.config.set('interfaceZoom', next)
  }, [])

  const adjustInterfaceZoom = useCallback((delta) => {
    updateInterfaceZoom(interfaceZoomRef.current + delta)
  }, [updateInterfaceZoom])

  const updateInterfaceFont = useCallback((value) => {
    const next = normalizeInterfaceFontId(value)
    setInterfaceFont(next)
    applyInterfacePreferencesToRoot(document.documentElement, {
      interfaceFont: next,
      interfaceWeight
    })
    window.api.config.set('interfaceFont', next)
  }, [interfaceWeight])

  const updateInterfaceWeight = useCallback((value) => {
    const next = normalizeInterfaceWeightId(value)
    setInterfaceWeight(next)
    applyInterfacePreferencesToRoot(document.documentElement, {
      interfaceFont,
      interfaceWeight: next
    })
    window.api.config.set('interfaceWeight', next)
  }, [interfaceFont])

  const updateFullscreenWidthMode = useCallback((val) => {
    setFullscreenWidthMode(val)
    window.api.config.set('fullscreenWidthMode', val)
  }, [])

  const updateFullscreenStandardWidth = useCallback((val) => {
    setFullscreenStandardWidth(val)
    window.api.config.set('fullscreenStandardWidth', val)
  }, [])

  const updateFullscreenWideWidth = useCallback((val) => {
    setFullscreenWideWidth(val)
    window.api.config.set('fullscreenWideWidth', val)
  }, [])

  const updateEditorLineHeight = useCallback((val) => {
    setEditorLineHeight(val)
    window.api.config.set('editorLineHeight', val)
  }, [])

  const updateEditorLetterSpacing = useCallback((val) => {
    setEditorLetterSpacing(val)
    window.api.config.set('editorLetterSpacing', val)
  }, [])



  const readDayData = useCallback(async (dateStr) => {
    // dateStr: YYYY-MM-DD
    const [year, month, day] = dateStr.split('-')
    const filePath = `${year}/${month}/${day}.json`
    const result = await window.api.fs.readFile(filePath)
    if (result.ok) {
      try { 
        const parsed = JSON.parse(result.data) 
        // Filter out empty entries immediately on read so they don't show up in Today
        const cleaned = {}
        for (const [k, v] of Object.entries(parsed)) {
           if (v?.value !== undefined && v?.value !== null && !isEntryEmpty(v.value)) {
             cleaned[k] = v
           }
        }
        return cleaned
      } catch (e) {
        // Fix #10: Log JSON parse errors instead of silently swallowing
        console.error(`Failed to parse data for ${dateStr}:`, e)
        return {}
      }
    }
    return {}
  }, [])

  const refreshDates = useCallback(async () => {
    const rawDates = await window.api.fs.scanDates()
    const checkedDates = await Promise.all(
      rawDates.map(async (dateStr) => {
        const dayData = await readDayData(dateStr)
        return Object.keys(dayData).length > 0 ? dateStr : null
      })
    )
    const datesWithRealData = checkedDates.filter(Boolean)
    setDatesWithData(datesWithRealData)
    return datesWithRealData
  }, [readDayData])

  // Initialize after the stable loading callbacks are defined.
  useEffect(() => {
    async function init() {
      try {
        const cfg = await window.api.config.get()
        const savedTheme = normalizeTheme(cfg.theme)
        const savedInterfaceStyle = normalizeInterfaceStyleId(cfg.interfaceStyle)
        const savedThemeAccent = normalizeThemeAccentId(cfg.themeAccent)
        const savedInterfaceZoom = normalizeInterfaceZoom(cfg.interfaceZoom)
        const savedInterfaceFont = normalizeInterfaceFontId(cfg.interfaceFont)
        const savedInterfaceWeight = normalizeInterfaceWeightId(cfg.interfaceWeight)
        const savedFrostedBackgroundBlur = normalizeFrostedBackgroundBlur(cfg.frostedBackgroundBlur)
        setTheme(savedTheme)
        setInterfaceStyle(savedInterfaceStyle)
        setThemeAccent(savedThemeAccent)
        interfaceZoomRef.current = savedInterfaceZoom
        setInterfaceZoom(savedInterfaceZoom)
        setInterfaceFont(savedInterfaceFont)
        setInterfaceWeight(savedInterfaceWeight)
        setFrostedBackgroundBlur(savedFrostedBackgroundBlur)
        applyAppearanceToRoot(document.documentElement, {
          interfaceStyle: savedInterfaceStyle,
          theme: savedTheme,
          themeAccent: savedThemeAccent
        })
        applyInterfacePreferencesToRoot(document.documentElement, {
          interfaceFont: savedInterfaceFont,
          interfaceWeight: savedInterfaceWeight
        })
        applyFrostedBackgroundBlur(document.documentElement, savedFrostedBackgroundBlur)
        const backgroundResult = await window.api.appearanceBackground.get()
        const savedFrostedBackground = backgroundResult.ok
          ? backgroundResult.background?.dataUrl ?? null
          : null
        setFrostedBackgroundUrl(savedFrostedBackground)
        await applyFrostedGlassBackground(document.documentElement, savedFrostedBackground)
        window.api.zoom.setFactor(savedInterfaceZoom / 100)

        setFullscreenWidthMode(cfg.fullscreenWidthMode || 'standard')
        setFullscreenStandardWidth(cfg.fullscreenStandardWidth || '700px')
        setFullscreenWideWidth(cfg.fullscreenWideWidth || '1000px')
        setEditorLineHeight(cfg.editorLineHeight || '1.8')
        setEditorLetterSpacing(cfg.editorLetterSpacing || '0px')

        const dir = await window.api.config.getDataDir()
        setDataDir(dir)

        await loadSections()
        await refreshDates()
        if (!await loadMetadata()) {
          showToast('图表、倒数日等配置无法读取，已暂用空配置。原文件在被覆盖前会存入自动历史，可在「设置 → 数据与备份 → 查看自动历史」中找回。', 'error', 9000)
        }
        setIsInitialized(true)
      } catch (e) {
        console.error('Init error:', e)
        setIsInitialized(true)
      }
    }
    init()
  }, [loadMetadata, loadSections, refreshDates, showToast])

  // Fix #9: Use functional update for setDatesWithData to eliminate stale closure dependency
  const writeDayData = useCallback(async (dateStr, data) => {
    const [year, month, day] = dateStr.split('-')
    const filePath = `${year}/${month}/${day}.json`
    
    // Clean data before writing: remove completely empty entries
    const cleanedData = {}
    for (const [k, v] of Object.entries(data)) {
       if (v?.value !== undefined && v?.value !== null && !isEntryEmpty(v.value)) {
         cleanedData[k] = v
       }
    }

    const hasRealContent = Object.keys(cleanedData).length > 0
    const result = hasRealContent
      ? await window.api.fs.writeFile(filePath, JSON.stringify(cleanedData, null, 2))
      : await window.api.fs.deleteFile(filePath)
    
    if (result.ok) {
      // Fix #9: Functional update avoids stale closure over datesWithData
      setDatesWithData(prev => {
        if (hasRealContent) {
          return prev.includes(dateStr) ? prev : [...prev, dateStr]
        } else {
          return prev.filter(d => d !== dateStr)
        }
      })
    }
    return result
  }, []) // Fix #9: No dependency on datesWithData

  // Custom Confirmation Dialog State
  const [confirmConfig, setConfirmConfig] = useState(null)

  const confirm = useCallback(({ message, title = '提示', confirmText = '确定', cancelText = '取消', danger = false }) => {
    return new Promise((resolve) => {
      setConfirmConfig({ message, title, confirmText, cancelText, danger, resolve })
    })
  }, [])

  return (
    <AppContext.Provider value={{
      theme, toggleTheme,
      interfaceStyle, updateInterfaceStyle,
      themeAccent, updateThemeAccent,
      frostedBackgroundUrl, importFrostedBackground, clearFrostedBackground,
      frostedBackgroundBlur, updateFrostedBackgroundBlur,
      interfaceZoom, updateInterfaceZoom, adjustInterfaceZoom,
      interfaceFont, updateInterfaceFont,
      interfaceWeight, updateInterfaceWeight,
      sections, setSections, loadSections, saveSections,
      datesWithData, refreshDates,
      toasts, showToast,
      dataDir, setDataDir,
      isInitialized,
      selectedDate, setSelectedDate,
      readDayData, writeDayData,
      fullscreenWidthMode, updateFullscreenWidthMode,
      fullscreenStandardWidth, updateFullscreenStandardWidth,
      fullscreenWideWidth, updateFullscreenWideWidth,
      editorLineHeight, updateEditorLineHeight,
      editorLetterSpacing, updateEditorLetterSpacing,
      countdowns, saveCountdowns,
      analytics, saveAnalytics,
      favorites, toggleFavorite,
      reloadMetadata: loadMetadata,
      confirm,
      // Fix #8: Expose flush registration for Today page
      registerPendingFlush, unregisterPendingFlush, flushPendingSaves
    }}>
      {children}
      {confirmConfig && (
        <div className="modal-overlay" onClick={() => { confirmConfig.resolve(false); setConfirmConfig(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">{confirmConfig.title}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => { confirmConfig.resolve(false); setConfirmConfig(null); }}>✕</button>
            </div>
            <div style={{ marginBottom: 20, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {confirmConfig.message.split('\n').map((line, idx) => (
                <p key={idx} style={{ marginTop: idx > 0 ? 8 : 0 }}>{line}</p>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => { confirmConfig.resolve(false); setConfirmConfig(null); }}>
                {confirmConfig.cancelText}
              </button>
              <button 
                className="btn btn-primary" 
                style={confirmConfig.danger ? { background: 'var(--error)' } : {}} 
                onClick={() => { confirmConfig.resolve(true); setConfirmConfig(null); }}
              >
                {confirmConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
