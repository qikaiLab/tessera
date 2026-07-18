import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveSafePath, isAllowedExternalUrl, isAppNavigationUrl } = require('../src/main/security.js')

describe('resolveSafePath', () => {
  const baseDir = path.resolve('C:/MotoTrace/data')

  it('resolves files inside the data directory', () => {
    expect(resolveSafePath(baseDir, 'notes/example.json')).toBe(
      path.join(baseDir, 'notes', 'example.json')
    )
  })

  it.each(['../secret.json', 'notes/../../secret.json'])('rejects traversal: %s', filePath => {
    expect(() => resolveSafePath(baseDir, filePath)).toThrow('Path traversal detected')
  })

  it('rejects absolute paths', () => {
    expect(() => resolveSafePath(baseDir, path.resolve('C:/secret.json'))).toThrow(
      'Absolute paths are not allowed'
    )
  })
})

describe('isAllowedExternalUrl', () => {
  it.each(['https://example.com', 'http://example.com', 'mailto:hello@example.com', 'tel:+123']) (
    'allows supported URL: %s',
    url => expect(isAllowedExternalUrl(url)).toBe(true)
  )

  it.each(['file:///C:/secret.txt', 'javascript:alert(1)', 'not a url']) (
    'rejects unsafe URL: %s',
    url => expect(isAllowedExternalUrl(url)).toBe(false)
  )
})

describe('isAppNavigationUrl', () => {
  it('allows only the configured renderer origin in development', () => {
    const options = { isDev: true, rendererUrl: 'http://localhost:5173' }
    expect(isAppNavigationUrl('http://localhost:5173/today', options)).toBe(true)
    expect(isAppNavigationUrl('https://example.com', options)).toBe(false)
  })

  it('allows file navigation only in packaged mode', () => {
    expect(isAppNavigationUrl('file:///app/renderer/index.html', { isDev: false })).toBe(true)
    expect(isAppNavigationUrl('https://example.com', { isDev: false })).toBe(false)
  })
})
