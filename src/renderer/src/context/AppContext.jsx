import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

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
  const metadataTimerRef = useRef(null)
  const hasChangedRef = useRef(false)

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

        if (migrated) {
          // Write back migrated data to metadata.json and clean up localStorage
          await window.api.metadata.set(JSON.stringify({ countdowns: cds, analytics: charts }, null, 2))
          localStorage.removeItem('mototrace_countdowns')
          localStorage.removeItem('mototrace_analytics')
        }
      } catch (e) {
        console.error('Failed to parse metadata.json:', e)
      }
    }
  }, [])

  const saveCountdowns = useCallback((cds) => {
    hasChangedRef.current = true
    setCountdowns(cds)
  }, [])

  const saveAnalytics = useCallback((cards) => {
    hasChangedRef.current = true
    setAnalytics(cards)
  }, [])

  // Debounced effect to save metadata when countdowns or analytics change
  useEffect(() => {
    if (!hasChangedRef.current) return

    if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current)
    metadataTimerRef.current = setTimeout(async () => {
      hasChangedRef.current = false
      const content = JSON.stringify({ countdowns, analytics }, null, 2)
      await window.api.metadata.set(content)
    }, 300)

    return () => {
      if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current)
    }
  }, [countdowns, analytics])

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        const cfg = await window.api.config.get()
        const savedTheme = cfg.theme || 'dark'
        setTheme(savedTheme)
        document.documentElement.setAttribute('data-theme', savedTheme)

        // Load typesetting config
        setFullscreenWidthMode(cfg.fullscreenWidthMode || 'standard')
        setFullscreenStandardWidth(cfg.fullscreenStandardWidth || '700px')
        setFullscreenWideWidth(cfg.fullscreenWideWidth || '1000px')
        setEditorLineHeight(cfg.editorLineHeight || '1.8')
        setEditorLetterSpacing(cfg.editorLetterSpacing || '0px')

        const dir = await window.api.config.getDataDir()
        setDataDir(dir)

        await loadSections()
        await refreshDates()
        await loadMetadata()
        setIsInitialized(true)
      } catch (e) {
        console.error('Init error:', e)
        setIsInitialized(true)
      }
    }
    init()
  }, [loadMetadata])

  const loadSections = useCallback(async () => {
    const result = await window.api.fs.readFile('sections.json')
    if (result.ok) {
      const s = JSON.parse(result.data)
      setSections(s)
      return s
    } else {
      // Default sections on first run
      const defaults = [
        { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
        { id: 'running', name: '今日跑步[m]', type: 'number', unit: 'm', resident: false, order: 1 }
      ]
      await saveSectionsData(defaults)
      setSections(defaults)
      return defaults
    }
  }, [])

  const saveSectionsData = useCallback(async (secs) => {
    await window.api.fs.writeFile('sections.json', JSON.stringify(secs, null, 2))
  }, [])

  const saveSections = useCallback(async (secs) => {
    setSections(secs)
    await saveSectionsData(secs)
  }, [saveSectionsData])


  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    window.api.config.set('theme', next)
  }, [theme])

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

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
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
      } catch { return {} }
    }
    return {}
  }, [])

  const refreshDates = useCallback(async () => {
    // fs:scanDates returns all YYYY-MM-DD that have a JSON file
    const rawDates = await window.api.fs.scanDates()
    
    // We need to filter out files that only contain empty/deleted data
    // to completely fix the calendar dot bug (Task 1 & 5)
    const validDates = []
    for (const d of rawDates) {
      const dayData = await readDayData(d)
      const hasRealContent = Object.values(dayData).some(
        entry => entry?.value !== undefined && entry?.value !== null && !isEntryEmpty(entry.value)
      )
      if (hasRealContent) validDates.push(d)
    }
    
    setDatesWithData(validDates)
    return validDates
  }, [readDayData])

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

    const result = await window.api.fs.writeFile(filePath, JSON.stringify(cleanedData, null, 2))
    
    if (result.ok) {
      // Check if the day still has any real content
      const hasRealContent = Object.keys(cleanedData).length > 0
      if (hasRealContent) {
        if (!datesWithData.includes(dateStr)) {
          setDatesWithData(prev => [...prev, dateStr])
        }
      } else {
        // All content deleted — remove date from index
        setDatesWithData(prev => prev.filter(d => d !== dateStr))
      }
    }
    return result
  }, [datesWithData])

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
      confirm
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
