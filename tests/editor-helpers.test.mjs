import { describe, expect, it } from 'vitest'
import {
  canRunEditorCommand,
  countChars,
  formatCssLetterSpacing,
  formatCssWidth,
  isTaskCheckbox,
  normalizeExternalUrl
} from '../src/renderer/src/components/TiptapEditor/editorHelpers.js'
import { isClearFormattingShortcut } from '../src/renderer/src/utils/editorShortcuts.js'

describe('normalizeExternalUrl', () => {
  it('passes web, mail and phone links through trimmed', () => {
    expect(normalizeExternalUrl('  https://example.com/a?b=1 ')).toBe('https://example.com/a?b=1')
    expect(normalizeExternalUrl('HTTP://EXAMPLE.COM')).toBe('HTTP://EXAMPLE.COM')
    expect(normalizeExternalUrl('mailto:me@example.com')).toBe('mailto:me@example.com')
    expect(normalizeExternalUrl('tel:+8613800000000')).toBe('tel:+8613800000000')
  })

  it('adds https to bare www addresses', () => {
    expect(normalizeExternalUrl('www.example.com')).toBe('https://www.example.com')
  })

  it('refuses anything else, so a link can never open a local file or script', () => {
    for (const href of ['', null, undefined, 'javascript:alert(1)', 'file:///C:/Windows', '/relative', '#anchor', 'example.com']) {
      expect(normalizeExternalUrl(href)).toBeNull()
    }
  })
})

describe('editor layout values from settings', () => {
  it('reads a bare number as pixels and keeps other units', () => {
    expect(formatCssWidth('720')).toBe('720px')
    expect(formatCssWidth(' 60ch ')).toBe('60ch')
    expect(formatCssWidth('', '1000px')).toBe('1000px')
    expect(formatCssWidth(undefined)).toBe('700px')
  })

  it('accepts fractional letter spacing', () => {
    expect(formatCssLetterSpacing('0.5')).toBe('0.5px')
    expect(formatCssLetterSpacing('1')).toBe('1px')
    expect(formatCssLetterSpacing('0.05em')).toBe('0.05em')
    expect(formatCssLetterSpacing(null)).toBe('0px')
  })
})

describe('editor instance helpers', () => {
  it('counts characters, and zero without an editor', () => {
    expect(countChars(null)).toBe(0)
    expect(countChars({ storage: {} })).toBe(0)
    expect(countChars({ storage: { characterCount: { characters: () => 12 } } })).toBe(12)
  })

  it('treats an unknown or failing command check as allowed', () => {
    expect(canRunEditorCommand(null, 'undo')).toBe(true)
    expect(canRunEditorCommand({ can: () => ({ undo: () => false }) }, 'undo')).toBe(false)
    expect(canRunEditorCommand({ can: () => ({}) }, 'undo')).toBe(true)
    expect(canRunEditorCommand({ can: () => { throw new Error('no view') } }, 'undo')).toBe(true)
  })

  it('recognises the checkbox of a to-do item', () => {
    const inside = { closest: selector => (selector.includes('taskList') ? {} : null) }
    expect(isTaskCheckbox(inside)).toBe(true)
    expect(isTaskCheckbox({ closest: () => null })).toBe(false)
    expect(isTaskCheckbox(null)).toBe(false)
  })
})

describe('isClearFormattingShortcut', () => {
  it('accepts Ctrl or Cmd with the backslash key', () => {
    expect(isClearFormattingShortcut({ ctrlKey: true, code: 'Backslash', key: '|' })).toBe(true)
    expect(isClearFormattingShortcut({ metaKey: true, key: '\\' })).toBe(true)
  })

  it('rejects other modifiers and keys', () => {
    expect(isClearFormattingShortcut({ key: '\\' })).toBe(false)
    expect(isClearFormattingShortcut({ ctrlKey: true, shiftKey: true, key: '\\' })).toBe(false)
    expect(isClearFormattingShortcut({ ctrlKey: true, altKey: true, key: '\\' })).toBe(false)
    expect(isClearFormattingShortcut({ ctrlKey: true, key: '/' })).toBe(false)
  })
})
