import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveRuntimeOverrides, shouldUseDevServer } from '../src/main/runtimeOverrides.js'

const userData = path.resolve('C:/Temp/mototrace-e2e/user')
const data = path.resolve('C:/Temp/mototrace-e2e/data')

describe('resolveRuntimeOverrides', () => {
  it('returns null when no override is configured', () => {
    expect(resolveRuntimeOverrides({})).toBeNull()
    expect(
      resolveRuntimeOverrides({ MOTOTRACE_USER_DATA_DIR: '', MOTOTRACE_DATA_DIR: '' })
    ).toBeNull()
  })

  it('returns both directories when both are set', () => {
    expect(
      resolveRuntimeOverrides({ MOTOTRACE_USER_DATA_DIR: userData, MOTOTRACE_DATA_DIR: data })
    ).toEqual({ userDataDir: userData, dataDir: data })
  })

  it('refuses a partial override that could fall back to real user data', () => {
    expect(() => resolveRuntimeOverrides({ MOTOTRACE_USER_DATA_DIR: userData })).toThrow(
      'must be set together'
    )
    expect(() => resolveRuntimeOverrides({ MOTOTRACE_DATA_DIR: data })).toThrow(
      'must be set together'
    )
  })

  it('rejects relative paths', () => {
    expect(() =>
      resolveRuntimeOverrides({ MOTOTRACE_USER_DATA_DIR: 'user', MOTOTRACE_DATA_DIR: data })
    ).toThrow('must be an absolute path')
  })
})

describe('shouldUseDevServer', () => {
  it('uses the dev server only for an unpackaged launch that received its URL', () => {
    const env = { ELECTRON_RENDERER_URL: 'http://localhost:5173' }
    expect(shouldUseDevServer({ isPackaged: false, env })).toBe(true)
    expect(shouldUseDevServer({ isPackaged: true, env })).toBe(false)
    expect(shouldUseDevServer({ isPackaged: false, env: {} })).toBe(false)
  })
})
