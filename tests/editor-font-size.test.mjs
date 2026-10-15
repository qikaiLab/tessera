import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampEditorFontSize, readEditorFontSize } from '../src/renderer/src/utils/editorFontSize.js'

function stubStorage(value) {
  vi.stubGlobal('localStorage', {
    getItem: () => value,
    setItem: () => {}
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('editor font size', () => {
  it('clamps to the sizes the editor offers', () => {
    expect(clampEditorFontSize(8)).toBe(12)
    expect(clampEditorFontSize(16)).toBe(16)
    expect(clampEditorFontSize(40)).toBe(24)
  })

  it('reads the stored size and falls back to 14', () => {
    stubStorage('18')
    expect(readEditorFontSize()).toBe(18)
    stubStorage(null)
    expect(readEditorFontSize()).toBe(14)
    stubStorage('not a number')
    expect(readEditorFontSize()).toBe(14)
    stubStorage('99')
    expect(readEditorFontSize()).toBe(24)
  })

  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => {} })
    expect(readEditorFontSize()).toBe(14)
  })
})
