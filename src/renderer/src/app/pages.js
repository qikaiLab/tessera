import { lazy } from 'react'

// The record page is the landing page and loads eagerly; the heavier pages (charts, the
// settings tree, ZIP handling) are split out so they only cost startup time when opened.
const pageLoaders = {
  timeline: () => import('../pages/Timeline'),
  calendar: () => import('../pages/Calendar'),
  analytics: () => import('../pages/Analytics'),
  notes: () => import('../pages/Notes'),
  settings: () => import('../pages/Settings')
}

export const Timeline = lazy(pageLoaders.timeline)
export const Calendar = lazy(pageLoaders.calendar)
export const Analytics = lazy(pageLoaders.analytics)
export const Notes = lazy(pageLoaders.notes)
export const Settings = lazy(pageLoaders.settings)

/**
 * Once the first screen has settled, fetch the other pages while the app is idle so opening
 * one never waits on its code (which would show up as a blank beat before the page fades in).
 */
export function preloadPagesWhenIdle() {
  const queue = Object.values(pageLoaders)
  const next = () => {
    const load = queue.shift()
    if (!load) return
    load().catch(() => {})
    schedule()
  }
  const schedule = () => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(next, { timeout: 4000 })
    else setTimeout(next, 600)
  }
  setTimeout(schedule, 1500)
}
