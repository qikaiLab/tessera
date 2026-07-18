import { describe, expect, it } from 'vitest'
import {
  FULLSCREEN_EDITOR_SHORTCUT_LABEL,
  isFullscreenEditorShortcut
} from '../src/renderer/src/utils/editorShortcuts.js'

describe('isFullscreenEditorShortcut', () => {
  it.each([
    { ctrlKey: true, metaKey: false },
    { ctrlKey: false, metaKey: true }
  ])('accepts the platform modifier with Shift+Enter', modifiers => {
    expect(isFullscreenEditorShortcut({
      ...modifiers,
      shiftKey: true,
      altKey: false,
      key: 'Enter'
    })).toBe(true)
  })

  it.each([
    { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'Enter' },
    { ctrlKey: true, metaKey: false, shiftKey: true, altKey: true, key: 'Enter' },
    { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: 'F11' },
    { ctrlKey: false, metaKey: false, shiftKey: true, altKey: false, key: 'Enter' },
    { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: 'Enter', repeat: true },
    { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: 'Enter', isComposing: true }
  ])('rejects conflicting or incomplete key combinations', event => {
    expect(isFullscreenEditorShortcut(event)).toBe(false)
  })

  it('keeps the discoverable Windows shortcut label in sync', () => {
    expect(FULLSCREEN_EDITOR_SHORTCUT_LABEL).toBe('Ctrl+Shift+Enter')
  })
})
