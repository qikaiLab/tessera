import React, { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Toast from './components/Toast'
import Onboarding from './components/Onboarding'
import ShortcutsModal from './components/ShortcutsModal'
import CrashRecovery from './components/CrashRecovery'
import ContextMenu from './components/ContextMenu'
import ErrorBoundary from './components/ErrorBoundary'
import Today from './pages/Today'
import { isThemeToggleAvailable } from './theme/appearanceRegistry'
import { APPEARANCE_MESSAGE_KEYS, appearanceText } from './theme/appearanceMessages'
import { getZoomDeltaFromKeyboardEvent, getZoomDeltaFromWheelEvent } from './theme/interfacePreferences'
import { editMenuItems, focusEditableTarget, getEditableSelectionState, showContextMenu } from './utils/contextMenu'
import './styles/App.css'
import './theme/appearanceSurfaces.css'

// The record page is the landing page and loads eagerly; the heavier pages (charts, the
// settings tree, ZIP handling) are split out so they only cost startup time when opened.
const Timeline = lazy(() => import('./pages/Timeline'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Notes = lazy(() => import('./pages/Notes'))
const Settings = lazy(() => import('./pages/Settings'))

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const APP_SIDEBAR_MIN = 160
const APP_SIDEBAR_MAX = 280
const APP_SIDEBAR_DEFAULT = 200

function PageBoundary({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <ErrorBoundary resetKey={location.pathname} onHome={() => navigate('/today')}>
      <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

function AppContent() {
  const { isInitialized, adjustInterfaceZoom } = useApp()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [tmpFiles, setTmpFiles] = useState([])
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('mototrace_sidebar_width') || '', 10)
    return Number.isFinite(saved) ? clamp(saved, APP_SIDEBAR_MIN, APP_SIDEBAR_MAX) : APP_SIDEBAR_DEFAULT
  })

  const startSidebarResize = (event) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    document.body.classList.add('is-resizing')

    const handleMove = (moveEvent) => {
      const nextWidth = clamp(startWidth + moveEvent.clientX - startX, APP_SIDEBAR_MIN, APP_SIDEBAR_MAX)
      setSidebarWidth(nextWidth)
      localStorage.setItem('mototrace_sidebar_width', String(nextWidth))
    }

    const handleUp = () => {
      document.body.classList.remove('is-resizing')
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  useEffect(() => {
    if (!isInitialized) return
    // Check if first run
    window.api.config.get().then(cfg => {
      if (!cfg.onboardingDone) setShowOnboarding(true)
    })
    // Check for crash recovery
    window.api.fs.checkTmpFiles().then(files => {
      if (files.length > 0) setTmpFiles(files)
    })
  }, [isInitialized])

  // Global F1 and Ctrl+/ keydown listeners
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const zoomDelta = getZoomDeltaFromKeyboardEvent(e)
      if (zoomDelta) {
        e.preventDefault()
        adjustInterfaceZoom(zoomDelta)
      } else if (e.key === 'F1') {
        e.preventDefault()
        setShowOnboarding(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [adjustInterfaceZoom])

  useEffect(() => {
    const handleGlobalWheel = (event) => {
      const zoomDelta = getZoomDeltaFromWheelEvent(event)
      if (!zoomDelta) return
      event.preventDefault()
      adjustInterfaceZoom(zoomDelta)
    }

    window.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', handleGlobalWheel, { capture: true })
  }, [adjustInterfaceZoom])

  useEffect(() => {
    const handleGlobalTextContextMenu = (event) => {
      if (event.defaultPrevented) return

      const selectionState = getEditableSelectionState(event.target)
      if (!selectionState || selectionState.isProseMirror) return

      focusEditableTarget(selectionState.target)
      showContextMenu(event, editMenuItems({
        canUndo: selectionState.canUndo,
        canRedo: selectionState.canRedo,
        canCut: selectionState.canCut,
        canCopy: selectionState.canCopy,
        canPaste: selectionState.canPaste,
        canSelectAll: selectionState.canSelectAll
      }), { scope: 'native-edit' })
    }

    window.addEventListener('contextmenu', handleGlobalTextContextMenu)
    return () => window.removeEventListener('contextmenu', handleGlobalTextContextMenu)
  }, [])

  const handleOnboardingDone = () => {
    setShowOnboarding(false)
    window.api.config.set('onboardingDone', true)
  }

  if (!isInitialized) {
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

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar
          width={sidebarWidth}
          onResizeStart={startSidebarResize}
          onOpenOnboarding={() => setShowOnboarding(true)}
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
      {showOnboarding && (
        <Onboarding
          onDone={handleOnboardingDone}
          onOpenShortcuts={() => setShowShortcuts(true)}
        />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {tmpFiles.length > 0 && (
        <CrashRecovery
          files={tmpFiles}
          onDone={() => setTmpFiles([])}
        />
      )}
    </div>
  )
}

function Sidebar({ width, onResizeStart, onOpenOnboarding }) {
  const { theme, toggleTheme, interfaceStyle } = useApp()
  const canToggleTheme = isThemeToggleAvailable(interfaceStyle)

  const navItems = [
    { to: '/today', icon: '✎', label: '记录', exact: false },
    { to: '/notes', icon: 'N', label: '便签' },
    { to: '/timeline', icon: '☰', label: '时间线' },
    { to: '/calendar', icon: '⊞', label: '日历' },
    { to: '/analytics', icon: '∑', label: '数据分析' },
    { to: '/settings', icon: '⚙', label: '设置' }
  ]

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-brand">
        <span className="brand-icon">◈</span>
        <span className="brand-name">MotoTrace</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
            end={item.exact}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="btn btn-ghost btn-icon"
          onClick={onOpenOnboarding}
          title="使用说明"
        >
          💡
        </button>
        <button
          className="theme-toggle btn btn-ghost btn-icon"
          onClick={toggleTheme}
          disabled={!canToggleTheme}
          title={canToggleTheme
            ? appearanceText(theme === 'dark'
              ? APPEARANCE_MESSAGE_KEYS.switchToLight
              : APPEARANCE_MESSAGE_KEYS.switchToDark)
            : appearanceText(APPEARANCE_MESSAGE_KEYS.fixedTheme)}
        >
          {theme === 'dark' ? '○' : '●'}
        </button>
        <span className="sidebar-version">v{__APP_VERSION__}</span>
      </div>
      <div
        className="sidebar-resize-handle"
        onMouseDown={onResizeStart}
        title="拖动调整侧边栏宽度"
      />
    </aside>
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
