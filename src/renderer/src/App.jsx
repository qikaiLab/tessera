import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Toast from './components/Toast'
import Onboarding from './components/Onboarding'
import CrashRecovery from './components/CrashRecovery'
import Today from './pages/Today'
import Timeline from './pages/Timeline'
import Calendar from './pages/Calendar'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import './styles/App.css'

function AppContent() {
  const { isInitialized, showToast } = useApp()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [tmpFiles, setTmpFiles] = useState([])

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
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/today" element={<Today />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      <Toast />
      {showOnboarding && <Onboarding onDone={handleOnboardingDone} />}
      {tmpFiles.length > 0 && (
        <CrashRecovery
          files={tmpFiles}
          onDone={() => setTmpFiles([])}
        />
      )}
    </div>
  )
}

function Sidebar() {
  const { theme, toggleTheme } = useApp()

  const navItems = [
    { to: '/today', icon: '◎', label: '记录', exact: false },
    { to: '/timeline', icon: '☰', label: '时间线' },
    { to: '/calendar', icon: '⊞', label: '日历' },
    { to: '/analytics', icon: '∑', label: '数据分析' },
    { to: '/settings', icon: '⚙', label: '设置' }
  ]

  return (
    <aside className="sidebar">
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
          className="theme-toggle btn btn-ghost btn-icon"
          onClick={toggleTheme}
          data-tooltip={theme === 'dark' ? '切换亮色主题' : '切换暗色主题'}
          title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
        >
          {theme === 'dark' ? '○' : '●'}
        </button>
        <span className="sidebar-version">v0.1.0</span>
      </div>
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
