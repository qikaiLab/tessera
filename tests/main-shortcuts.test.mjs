import { describe, expect, it } from 'vitest'
import { isBlockedShortcut, isFullScreenShortcut } from '../src/main/shortcuts.js'

const key = (name, extra = {}) => ({ type: 'keyDown', key: name, control: false, meta: false, shift: false, alt: false, ...extra })

describe('blocked shortcuts in the packaged app', () => {
  it('blocks every way of reloading the page', () => {
    expect(isBlockedShortcut(key('F5'))).toBe(true)
    expect(isBlockedShortcut(key('F5', { shift: true }))).toBe(true)
    expect(isBlockedShortcut(key('r', { control: true }))).toBe(true)
    expect(isBlockedShortcut(key('R', { control: true, shift: true }))).toBe(true)
    expect(isBlockedShortcut(key('r', { meta: true }))).toBe(true)
  })

  it('blocks the developer tools', () => {
    expect(isBlockedShortcut(key('F12'))).toBe(true)
    expect(isBlockedShortcut(key('I', { control: true, shift: true }))).toBe(true)
    expect(isBlockedShortcut(key('i', { meta: true, shift: true }))).toBe(true)
  })

  it('leaves ordinary typing and the editor shortcuts alone', () => {
    expect(isBlockedShortcut(key('r'))).toBe(false)
    expect(isBlockedShortcut(key('i', { control: true }))).toBe(false) // italic
    expect(isBlockedShortcut(key('c', { control: true }))).toBe(false)
    expect(isBlockedShortcut(key('z', { control: true }))).toBe(false)
    expect(isBlockedShortcut(key('F2'))).toBe(false)
  })

  it('keeps F11 for the full screen the default menu used to provide', () => {
    expect(isFullScreenShortcut(key('F11'))).toBe(true)
    expect(isFullScreenShortcut(key('f11'))).toBe(true)
    expect(isFullScreenShortcut(key('F11', { shift: true }))).toBe(false)
    expect(isFullScreenShortcut(key('F11', { alt: true }))).toBe(false)
    expect(isFullScreenShortcut(key('F11', { type: 'keyUp' }))).toBe(false)
    // Holding the key repeats the press: only the first one toggles.
    expect(isFullScreenShortcut(key('F11', { isAutoRepeat: false }))).toBe(true)
    expect(isFullScreenShortcut(key('F11', { isAutoRepeat: true }))).toBe(false)
    expect(isFullScreenShortcut(key('F10'))).toBe(false)
    expect(isFullScreenShortcut(undefined)).toBe(false)
    // It is not one of the blocked ones.
    expect(isBlockedShortcut(key('F11'))).toBe(false)
  })

  it('only reacts to key presses, not releases', () => {
    expect(isBlockedShortcut(key('F5', { type: 'keyUp' }))).toBe(false)
    expect(isBlockedShortcut(undefined)).toBe(false)
  })
})
