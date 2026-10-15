import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Toast from './components/Toast'
import Onboarding from './components/Onboarding'
import ShortcutsModal from './components/ShortcutsModal'
import CrashRecovery from './components/CrashRecovery'
import ContextMenu from './components/ContextMenu'
import Presence from './components/Presence'
import Today from './pages/Today'
import PageBoundary from './app/PageBoundary'
import Sidebar from './app/Sidebar'
import { Analytics, Calendar, Notes, Settings, Timeline, preloadPagesWhenIdle } from './app/pages'
import { useGlobalInput } from './app/useGlobalInput'
import { useResizableWidth } from './utils/useResizableWidth'
import './styles/App.css'
import './theme/appearanceSurfaces.css'

const APP_SIDEBAR_MIN = 160
const APP_SIDEBAR_MAX = 280
const APP_SIDEBAR_DEFAULT = 200

function AppLoading() {
  return (
    <div className="app-loading">
      <div className="loading-logo">
        <span className="loading-icon">◎</span>
        <span className="loading-text">MotoTrace</span>
      </div>
      <div className="loading-spinner" />
    </div>
  )
}

function AppContent() {
  const { isInitialized, adjustInterfaceZoom } = useApp()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [tmpFiles, setTmpFiles] = useState([])
  const sidebar = useResizableWidth({
    storageKey: 'mototrace_sidebar_width',
    min: APP_SIDEBAR_MIN,
    max: APP_SIDEBAR_MAX,
    initial: APP_SIDEBAR_DEFAULT
  })

  const openOnboarding = useCallback(() => setShowOnboarding(true), [])
  const toggleShortcuts = useCallback(() => setShowShortcuts(prev => !prev), [])
  useGlobalInput({ adjustInterfaceZoom, onOpenGuide: openOnboarding, onToggleShortcuts: toggleShortcuts })

  useEffect(() => {
    if (!isInitialized) return
    // First run: show the guide.
    window.api.config.get().then(cfg => {
      if (!cfg.onboardingDone) setShowOnboarding(true)
    })
    // Leftover temporary files mean the last save was interrupted.
    window.api.fs.checkTmpFiles().then(files => {
      if (files.length > 0) setTmpFiles(files)
    })
    preloadPagesWhenIdle()
  }, [isInitialized])

  const handleOnboardingDone = () => {
    setShowOnboarding(false)
    window.api.config.set('onboardingDone', true)
  }

  if (!isInitialized) return <AppLoading />

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar
          width={sidebar.width}
          onResizeStart={sidebar.startResize}
          onOpenOnboarding={openOnboarding}
        />
        <main className="app-main">
          <PageBoundary>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/today" element={<Today />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </PageBoundary>
        </main>
      </div>
      <Toast />
      <ContextMenu />
      <Presence>{showOnboarding && (
        <Onboarding
          onDone={handleOnboardingDone}
          onOpenShortcuts={() => setShowShortcuts(true)}
        />
      )}</Presence>
      <Presence>{showShortcuts && <ShortcutsModal stacked={showOnboarding} onClose={() => setShowShortcuts(false)} />}</Presence>
      {tmpFiles.length > 0 && (
        <CrashRecovery
          files={tmpFiles}
          onDone={() => setTmpFiles([])}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProvider>
  )
}
