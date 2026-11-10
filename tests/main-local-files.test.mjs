import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OPENABLE_EXTENSIONS,
  isOpenableFile,
  openLocalPath,
  parseLocalFilePath,
  resetOpenGuard
} from '../src/main/localFiles.js'
import { isAppNavigationUrl } from '../src/main/security.js'

describe('parseLocalFilePath', () => {
  it('accepts absolute drive paths and normalizes the slashes', () => {
    expect(parseLocalFilePath('C:\\Users\\me\\a.jpg')).toBe('C:\\Users\\me\\a.jpg')
    expect(parseLocalFilePath('d:/trip/a.jpg')).toBe('d:\\trip\\a.jpg')
  })

  it.each([
    '',
    null,
    42,
    'photo.jpg',
    '\\\\server\\share\\a.jpg',
    '//server/share/a.jpg',
    '\\\\?\\C:\\a.jpg',
    'C:photo.jpg',
    'C:\\a\\..\\b.jpg',
    'C:\\a\\b.jpg:stream',
    'C:\\a\\b*.jpg',
    'C:\\a\\b\u0000.jpg',
    `C:\\${'a'.repeat(2000)}`,
    'file:///C:/a.jpg',
    'javascript:alert(1)'
  ])('rejects %j', input => {
    expect(parseLocalFilePath(input)).toBeNull()
  })
})

describe('isOpenableFile', () => {
  it('opens photos and plain text', () => {
    for (const name of ['a.jpg', 'A.JPG', 'a.jpeg', 'a.png', 'a.webp', 'a.heic', 'a.txt', 'a.md', 'a.csv', 'a.log']) {
      expect(isOpenableFile(`C:\\x\\${name}`)).toBe(true)
    }
  })

  it('never opens anything that can run code or carry scripts', () => {
    for (const name of [
      'a.exe', 'a.bat', 'a.cmd', 'a.ps1', 'a.vbs', 'a.js', 'a.lnk', 'a.msi', 'a.scr', 'a.jar', 'a.com',
      'a.html', 'a.htm', 'a.svg', 'a.hta', 'a.docx', 'a.xlsm', 'a.pdf', 'a.url', 'a.reg', 'noextension'
    ]) {
      expect(isOpenableFile(`C:\\x\\${name}`)).toBe(false)
    }
    expect([...OPENABLE_EXTENSIONS].every(ext => /^\.[a-z0-9]+$/.test(ext))).toBe(true)
  })

  it('looks at the real last extension, not a harmless-looking earlier one', () => {
    expect(isOpenableFile('C:\\x\\photo.jpg.exe')).toBe(false)
    expect(isOpenableFile('C:\\x\\photo.exe.jpg')).toBe(true)
    // Windows drops trailing dots and spaces, so these are really a.exe
    expect(isOpenableFile('C:\\x\\a.exe.')).toBe(false)
    expect(isOpenableFile('C:\\x\\a.jpg ')).toBe(false)
    expect(isOpenableFile('C:\\x\\a.jpg.')).toBe(false)
  })
})

describe('openLocalPath', () => {
  const file = { isDirectory: () => false }
  const folder = { isDirectory: () => true }
  let shell

  function fsFor(entries) {
    return {
      promises: {
        realpath: vi.fn(async (target) => {
          const entry = entries[target]
          if (!entry) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
          return entry.real ?? target
        }),
        stat: vi.fn(async (target) => {
          const entry = Object.values(entries).find(item => (item.real ?? null) === target) || entries[target]
          if (!entry) throw new Error('ENOENT')
          return entry.stat
        })
      }
    }
  }

  beforeEach(() => {
    resetOpenGuard()
    shell = { openPath: vi.fn().mockResolvedValue(''), showItemInFolder: vi.fn() }
  })

  it('opens a photo with the default app', async () => {
    const fsApi = fsFor({ 'C:\\p\\a.jpg': { stat: file } })
    expect(await openLocalPath('C:/p/a.jpg', { shell, fsApi })).toEqual({ ok: true, mode: 'opened' })
    expect(shell.openPath).toHaveBeenCalledWith('C:\\p\\a.jpg')
    expect(shell.showItemInFolder).not.toHaveBeenCalled()
  })

  it('only shows other kinds of file in Explorer, never starting them', async () => {
    const fsApi = fsFor({ 'C:\\p\\setup.exe': { stat: file }, 'C:\\p\\doc.docx': { stat: file } })
    expect(await openLocalPath('C:\\p\\setup.exe', { shell, fsApi })).toEqual({ ok: true, mode: 'revealed' })
    expect(await openLocalPath('C:\\p\\doc.docx', { shell, fsApi })).toEqual({ ok: true, mode: 'revealed' })
    expect(shell.openPath).not.toHaveBeenCalled()
    expect(shell.showItemInFolder).toHaveBeenCalledWith('C:\\p\\setup.exe')
  })

  it('does not follow a photo-named link to a program', async () => {
    const fsApi = fsFor({ 'C:\\p\\holiday.jpg': { real: 'C:\\tools\\evil.exe', stat: file } })
    expect(await openLocalPath('C:\\p\\holiday.jpg', { shell, fsApi })).toEqual({ ok: true, mode: 'revealed' })
    expect(shell.openPath).not.toHaveBeenCalled()
  })

  it('opens a folder in Explorer', async () => {
    const fsApi = fsFor({ 'C:\\p': { stat: folder } })
    expect(await openLocalPath('C:\\p', { shell, fsApi })).toEqual({ ok: true, mode: 'folder' })
    expect(shell.openPath).toHaveBeenCalledWith('C:\\p')
  })

  it('reports a missing target, a refused path and a failed open', async () => {
    const fsApi = fsFor({ 'C:\\p\\a.jpg': { stat: file } })
    expect(await openLocalPath('C:\\p\\gone.jpg', { shell, fsApi })).toEqual({ ok: false, error: 'not-found' })
    expect(await openLocalPath('\\\\server\\share\\a.jpg', { shell, fsApi })).toEqual({ ok: false, error: 'invalid-path' })
    expect(await openLocalPath('C:\\p\\..\\a.jpg', { shell, fsApi })).toEqual({ ok: false, error: 'invalid-path' })
    shell.openPath.mockResolvedValue('Windows cannot open it')
    expect(await openLocalPath('C:\\p\\a.jpg', { shell, fsApi })).toEqual({ ok: false, error: 'open-failed' })
    expect(shell.showItemInFolder).not.toHaveBeenCalled()
  })

  it('refuses a link that resolves to a network share', async () => {
    const fsApi = fsFor({ 'Z:\\p\\a.jpg': { real: '\\\\server\\share\\a.jpg', stat: file } })
    expect(await openLocalPath('Z:\\p\\a.jpg', { shell, fsApi })).toEqual({ ok: false, error: 'network-path' })
    expect(shell.openPath).not.toHaveBeenCalled()
  })

  it('opens a double-clicked link once', async () => {
    const fsApi = fsFor({ 'C:\\p\\a.jpg': { stat: file } })
    let clock = 1000
    const now = () => clock
    await openLocalPath('C:\\p\\a.jpg', { shell, fsApi, now })
    clock += 300
    await openLocalPath('C:\\p\\a.jpg', { shell, fsApi, now })
    expect(shell.openPath).toHaveBeenCalledTimes(1)
    clock += 5000
    await openLocalPath('C:\\p\\a.jpg', { shell, fsApi, now })
    expect(shell.openPath).toHaveBeenCalledTimes(2)
  })
})

describe('window navigation in a packaged app', () => {
  const appIndexUrl = 'file:///C:/Program%20Files/MotoTrace/resources/app.asar/out/renderer/index.html'

  it('stays on the app page, with or without a route hash', () => {
    expect(isAppNavigationUrl(appIndexUrl, { isDev: false, appIndexUrl })).toBe(true)
    expect(isAppNavigationUrl(`${appIndexUrl}#/notes`, { isDev: false, appIndexUrl })).toBe(true)
  })

  it('never lets a link to a local file replace the app', () => {
    for (const url of ['file:///C:/Users/me/a.jpg', 'file:///C:/Windows/System32/calc.exe', 'file://server/share/a.jpg']) {
      expect(isAppNavigationUrl(url, { isDev: false, appIndexUrl })).toBe(false)
    }
  })
})
