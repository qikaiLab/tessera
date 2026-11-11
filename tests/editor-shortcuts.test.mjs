import { describe, expect, it } from 'vitest'
import {
  FULLSCREEN_EDITOR_SHORTCUT_LABEL,
  isFullscreenEditorShortcut,
  isLeaveFullscreenKey
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

describe('isLeaveFullscreenKey', () => {
  const noMenu = { querySelector: () => null }
  const menuOpen = { querySelector: selector => (selector === '.slash-menu' ? {} : null) }

  it('treats a plain Esc as a request to leave fullscreen', () => {
    expect(isLeaveFullscreenKey({ key: 'Escape' }, noMenu)).toBe(true)
  })

  it('leaves Esc to the slash menu while it is open', () => {
    expect(isLeaveFullscreenKey({ key: 'Escape' }, menuOpen)).toBe(false)
  })

  it.each(['.app-context-menu', '.modal-overlay', '.shortcuts-overlay', '.onboarding-overlay'])(
    'leaves Esc to an open %s',
    owner => {
      const open = { querySelector: selector => (selector === owner ? {} : null) }
      expect(isLeaveFullscreenKey({ key: 'Escape' }, open)).toBe(false)
    }
  )

  it('leaves Esc to the input method while composing', () => {
    expect(isLeaveFullscreenKey({ key: 'Escape', isComposing: true }, noMenu)).toBe(false)
    expect(isLeaveFullscreenKey({ key: 'Escape', keyCode: 229 }, noMenu)).toBe(false)
  })

  it('ignores every other key', () => {
    expect(isLeaveFullscreenKey({ key: 'Enter' }, noMenu)).toBe(false)
  })
})
