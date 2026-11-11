// Reload and developer-tools shortcuts only work while developing: a reload discards edits that have
// not been saved yet, and the page has no use for the tools in a packaged build.
export function isBlockedShortcut(input) {
  if (!input || input.type !== 'keyDown') return false
  const key = String(input.key).toLowerCase()
  const modifier = Boolean(input.control || input.meta)
  if (key === 'f5' || key === 'f12') return true
  if (!modifier) return false
  return key === 'r' || (Boolean(input.shift) && key === 'i')
}

// F11 toggles the window's full screen. The packaged app has no menu (that is how the reload and
// developer-tools shortcuts are gone), and the default menu is what used to provide this one.
export function isFullScreenShortcut(input) {
  if (!input || input.type !== 'keyDown') return false
  if (String(input.key).toLowerCase() !== 'f11') return false
  return !input.control && !input.meta && !input.alt && !input.shift
}
