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

  it('returns both directories, fixed, when both are set', () => {
    expect(
      resolveRuntimeOverrides({ MOTOTRACE_USER_DATA_DIR: userData, MOTOTRACE_DATA_DIR: data })
    ).toEqual({ userDataDir: userData, dataDir: data, fixedDataDir: true })
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

describe('development isolation', () => {
  const appDataDir = path.resolve('C:/Users/me/AppData/Roaming')
  const homeDir = path.resolve('C:/Users/me')
  const dev = { isPackaged: false, appDataDir, homeDir }

  it('never overrides a packaged app', () => {
    expect(resolveRuntimeOverrides({}, { ...dev, isPackaged: true })).toBeNull()
  })

  it('gives an unpackaged run its own userData and data directories', () => {
    const overrides = resolveRuntimeOverrides({}, dev)
    expect(overrides).toEqual({
      userDataDir: path.join(appDataDir, 'mototrace-dev'),
      dataDir: path.join(homeDir, 'MotoTrace-dev', 'data'),
      fixedDataDir: false
    })
    // Must differ from the installed app's userData ("mototrace") and data directory.
    expect(overrides.userDataDir).not.toBe(path.join(appDataDir, 'mototrace'))
    expect(overrides.dataDir).not.toBe(path.join(homeDir, 'MotoTrace', 'data'))
  })

  it('lets an explicit opt-in use the real data', () => {
    expect(resolveRuntimeOverrides({ MOTOTRACE_USE_REAL_DATA: '1' }, dev)).toBeNull()
  })

  it('prefers explicit directories over the development defaults', () => {
    expect(
      resolveRuntimeOverrides({ MOTOTRACE_USER_DATA_DIR: userData, MOTOTRACE_DATA_DIR: data }, dev)
    ).toMatchObject({ userDataDir: userData, dataDir: data, fixedDataDir: true })
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
