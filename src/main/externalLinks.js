import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { shell } from 'electron'
import { appState } from './appState.js'
import { isAllowedExternalUrl, isAppNavigationUrl as isAllowedAppNavigation } from './security.js'

// The same link opened twice within this long (a double click) opens once.
const DUPLICATE_OPEN_WINDOW_MS = 1200
let lastExternalOpen = { url: '', time: 0 }

// Whether the window may navigate to `url` itself (the app's own pages); everything else opens
// in the system browser or not at all.
export function isAppNavigationUrl(url) {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'
  const appIndexUrl = pathToFileURL(path.join(__dirname, '../renderer/index.html')).href
  return isAllowedAppNavigation(url, { isDev: appState.isDev, rendererUrl, appIndexUrl })
}

export async function openExternalUrl(url) {
  if (!isAllowedExternalUrl(url)) {
    throw new Error('Unsupported external link protocol')
  }
  const normalizedUrl = new URL(url).toString()
  const now = Date.now()
  if (lastExternalOpen.url === normalizedUrl && now - lastExternalOpen.time < DUPLICATE_OPEN_WINDOW_MS) return
  lastExternalOpen = { url: normalizedUrl, time: now }
  await shell.openExternal(normalizedUrl)
}

// Opens `url` in the system browser if its protocol is allowed, logging a failure.
export function openExternalQuietly(url) {
  if (!isAllowedExternalUrl(url)) return
  openExternalUrl(url).catch(error => console.error('Failed to open external URL:', error))
}
