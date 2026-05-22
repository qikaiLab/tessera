import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AppContext = createContext(null)

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
        setIsInitialized(true)
      } catch (e) {
        console.error('Init error:', e)
        setIsInitialized(true)
      }
    }
    init()
  }, [])

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
           if (v?.value !== undefined && v?.value !== null && String(v?.value).trim() !== '') {
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
        entry => entry?.value !== undefined && entry?.value !== null && String(entry?.value).trim() !== ''
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
       if (v?.value !== undefined && v?.value !== null && String(v?.value).trim() !== '') {
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
      editorLetterSpacing, updateEditorLetterSpacing
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
