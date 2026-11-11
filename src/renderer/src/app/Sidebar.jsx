import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { isThemeToggleAvailable } from '../theme/appearanceRegistry'
import { APPEARANCE_MESSAGE_KEYS, appearanceText } from '../theme/appearanceMessages'

const NAV_ITEMS = [
  { to: '/today', icon: '✎', label: '记录' },
  { to: '/notes', icon: 'N', label: '便签' },
  { to: '/timeline', icon: '☰', label: '时间线' },
  { to: '/calendar', icon: '⊞', label: '日历' },
  { to: '/analytics', icon: '∑', label: '数据分析' },
  { to: '/settings', icon: '⚙', label: '设置' }
]

// The highlight behind the current page slides between nav items instead of jumping.
function useNavIndicator(navRef, pathname) {
  const [box, setBox] = useState(null)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return undefined
    const measure = () => {
      const active = nav.querySelector('.nav-item.active')
      setBox(active ? { top: active.offsetTop, height: active.offsetHeight } : null)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(nav)
    return () => observer?.disconnect()
  }, [navRef, pathname])

  // Skip the slide on the very first placement.
  useEffect(() => {
    if (!box || ready) return undefined
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [box, ready])

  return { box, ready }
}

// The page list, the theme toggle and the drag handle that resizes the sidebar.
export default function Sidebar({ width, onResizeStart, onOpenOnboarding, onOpenAbout }) {
  const { theme, toggleTheme, interfaceStyle } = useApp()
  const canToggleTheme = isThemeToggleAvailable(interfaceStyle)
  const location = useLocation()
  const navRef = useRef(null)
  const { box: indicatorBox, ready: indicatorReady } = useNavIndicator(navRef, location.pathname)

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-brand">
        <span className="brand-icon">◈</span>
        <span className="brand-name">MotoTrace</span>
      </div>
      <nav className="sidebar-nav" ref={navRef}>
        {indicatorBox && (
          <span
            className={`nav-indicator ${indicatorReady ? 'is-ready' : ''}`}
            style={{ height: indicatorBox.height, transform: `translateY(${indicatorBox.top}px)` }}
            aria-hidden="true"
          />
        )}
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            // The app opens on "/", which shows the record page too.
            className={({ isActive }) =>
              `nav-item ${isActive || (item.to === '/today' && location.pathname === '/') ? 'active' : ''}`
            }
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
        <button
          className="sidebar-version"
          onClick={onOpenAbout}
          title="关于、作者与许可"
          aria-label={`关于，版本 ${__APP_VERSION__}`}
        >
          <span className="sidebar-version-mark" aria-hidden="true">ⓘ</span>
          v{__APP_VERSION__}
        </button>
      </div>
      <div
        className="sidebar-resize-handle"
        onMouseDown={onResizeStart}
        title="拖动调整侧边栏宽度"
      />
    </aside>
  )
}
