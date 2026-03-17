import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [sections, setSections] = useState([])
  const [datesWithData, setDatesWithData] = useState([])
  const [toasts, setToasts] = useState([])
  const [dataDir, setDataDir] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        const cfg = await window.api.config.get()
        const savedTheme = cfg.theme || 'dark'
        setTheme(savedTheme)
        document.documentElement.setAttribute('data-theme', savedTheme)

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

  const refreshDates = useCallback(async () => {
    const dates = await window.api.fs.scanDates()
    setDatesWithData(dates)
    return dates
  }, [])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    window.api.config.set('theme', next)
  }, [theme])

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
      try { return JSON.parse(result.data) } catch { return {} }
    }
    return {}
  }, [])

  const writeDayData = useCallback(async (dateStr, data) => {
    const [year, month, day] = dateStr.split('-')
    const filePath = `${year}/${month}/${day}.json`
    const result = await window.api.fs.writeFile(filePath, JSON.stringify(data, null, 2))
    if (result.ok) {
      // Update dates index if needed
      if (!datesWithData.includes(dateStr)) {
        setDatesWithData(prev => [...prev, dateStr])
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
      readDayData, writeDayData
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
