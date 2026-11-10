import { describe, expect, it } from 'vitest'
import { isBlockedShortcut } from '../src/main/shortcuts.js'

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

  it('only reacts to key presses, not releases', () => {
    expect(isBlockedShortcut(key('F5', { type: 'keyUp' }))).toBe(false)
    expect(isBlockedShortcut(undefined)).toBe(false)
  })
})
