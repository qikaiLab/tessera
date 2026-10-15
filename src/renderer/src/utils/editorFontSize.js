import { useCallback, useState } from 'react'
import { clamp } from './math'

const STORAGE_KEY = 'mototrace_font_size'
export const EDITOR_FONT_SIZE_MIN = 12
export const EDITOR_FONT_SIZE_MAX = 24
const EDITOR_FONT_SIZE_DEFAULT = 14

export function clampEditorFontSize(size) {
  return clamp(size, EDITOR_FONT_SIZE_MIN, EDITOR_FONT_SIZE_MAX)
}

// The editor font size shared by the record cards, their fullscreen editors and the timeline
// preview. Stored in this browser profile only.
export function readEditorFontSize() {
  try {
    const stored = parseInt(localStorage.getItem(STORAGE_KEY) || String(EDITOR_FONT_SIZE_DEFAULT), 10)
    return Number.isFinite(stored) ? clampEditorFontSize(stored) : EDITOR_FONT_SIZE_DEFAULT
  } catch {
    return EDITOR_FONT_SIZE_DEFAULT
  }
}

export function useEditorFontSize() {
  const [fontSize, setFontSize] = useState(readEditorFontSize)

  const changeFontSize = useCallback((size) => {
    const next = clampEditorFontSize(size)
    setFontSize(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Storage unavailable: the size still applies for this session.
    }
  }, [])

  return [fontSize, changeFontSize]
}
