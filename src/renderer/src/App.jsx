import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Toast from './components/Toast'
import Onboarding from './components/Onboarding'
import ShortcutsModal from './components/ShortcutsModal'
import CrashRecovery from './components/CrashRecovery'
import AboutDialog from './components/about/AboutDialog'
import BrandMark from './components/BrandMark'
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
        <BrandMark size={32} className="loading-icon" />
        <span className="loading-text">Tessera</span>
      </div>
      <div className="loading-spinner" />
    </div>
  )
}

function AppContent() {
  const { isInitialized, adjustInterfaceZoom } = useApp()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [tmpFiles, setTmpFiles] = useState([])
  const sidebar = useResizableWidth({
    storageKey: 'mototrace_sidebar_width',
    min: APP_SIDEBAR_MIN,
    max: APP_SIDEBAR_MAX,
    initial: APP_SIDEBAR_DEFAULT
  })

  // `guideFirstRun`: the guide opened by itself on the first launch, so its button says "开始使用".
  const [guideFirstRun, setGuideFirstRun] = useState(false)
  const openOnboarding = useCallback(() => {
    setGuideFirstRun(false)
    setShowOnboarding(true)
  }, [])
  const toggleShortcuts = useCallback(() => setShowShortcuts(prev => !prev), [])
  useGlobalInput({ adjustInterfaceZoom, onOpenGuide: openOnboarding, onToggleShortcuts: toggleShortcuts })

  useEffect(() => {
    if (!isInitialized) return
    // First run: show the guide.
    window.api.config.get().then(cfg => {
      if (!cfg.onboardingDone) {
        setGuideFirstRun(true)
        setShowOnboarding(true)
      }
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
          onOpenAbout={() => setShowAbout(true)}
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
      {/* The recovery question comes first: it is shown above everything, and the guide and the shortcut
          list wait until it is answered, so the keyboard never belongs to a dialog hidden beneath it. */}
      <Presence>{showOnboarding && tmpFiles.length === 0 && (
        <Onboarding
          onDone={handleOnboardingDone}
          onOpenShortcuts={() => setShowShortcuts(true)}
          firstRun={guideFirstRun}
        />
      )}</Presence>
      <Presence>{showShortcuts && tmpFiles.length === 0 && <ShortcutsModal stacked={showOnboarding} onClose={() => setShowShortcuts(false)} />}</Presence>
      <Presence>{showAbout && tmpFiles.length === 0 && <AboutDialog onClose={() => setShowAbout(false)} />}</Presence>
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
