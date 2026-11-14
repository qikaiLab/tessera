import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl, isAppNavigationUrl, isPathInside, resolveSafePath } from '../../src/main/security.js'
import { parseLocalFilePath } from '../../src/main/localFiles.js'
import { fileUrlToLocalPath, isLocalFileHref, localPathToFileUrl } from '../../src/renderer/src/utils/localFileLinks.js'
import { findInvalidArchiveEntries } from '../../src/renderer/src/utils/dataArchive.js'
import { anyText, fuzzParams } from './arbitrary.mjs'

// The paths and links that come from outside the app: the renderer's file requests, imported
// archives, links typed into notes. Whatever they contain, nothing may reach outside the data
// directory, and the renderer and the main process must agree on what a safe local link is.

const baseDir = path.resolve('C:/Tessera/data')

// Path-ish strings: real segments mixed with separators, dots, drive letters, device names and
// the characters Windows treats specially.
const segment = fc.oneof(
  fc.constantFrom('..', '.', '...', '', ' ', 'a', 'notes', '2026', '10', '13.json', 'index.json', 'CON', 'nul', 'COM1', 'aux.json', 'x:y', 'a.json:stream', 'name.', 'name ', '~1', 'PROGRA~1', '%2e%2e', '%2F', '日记', 'a?b', 'a*b', 'a|b', '<x>', '"q"'),
  fc.string({ maxLength: 8 })
)
const separator = fc.constantFrom('/', '\\', '//', '\\\\', '/\\', '/./')
const pathLike = fc.tuple(fc.array(fc.tuple(segment, separator), { maxLength: 6 }), segment).map(([parts, last]) => parts.map(([name, sep]) => name + sep).join('') + last)

describe('resolveSafePath', () => {
  it('never resolves to anything outside the data directory', () => {
    fc.assert(fc.property(fc.oneof(pathLike, anyText), (requested) => {
      let resolved
      try {
        resolved = resolveSafePath(baseDir, requested)
      } catch {
        return // refusing is always fine
      }
      expect(isPathInside(baseDir, resolved)).toBe(true)
      // And never the data directory itself, which is not a file.
      expect(path.relative(baseDir, resolved)).not.toBe('')
    }), fuzzParams({ numRuns: 2000 }))
  })

  it('rejects every spelling of going up, however many separators or dots', () => {
    for (const requested of ['..', '../x', '..\\x', 'a/../../x', 'a\\..\\..\\x', './../x', 'a//..//..//x', 'notes/./../../x', '....//x'.replace('....', '..')]) {
      expect(() => resolveSafePath(baseDir, requested), requested).toThrow()
    }
  })

  it('rejects absolute paths, drive-relative paths and network paths', () => {
    for (const requested of ['C:\\x.json', 'C:/x.json', '\\\\server\\share\\x.json', '//server/share/x.json', '\\x.json', '/x.json', 'D:x.json', '\\\\?\\C:\\x.json', '\\\\.\\C:\\x.json']) {
      let resolved = null
      try {
        resolved = resolveSafePath(baseDir, requested)
      } catch {
        continue
      }
      // If a spelling were accepted, it must still land inside the data directory.
      expect(isPathInside(baseDir, resolved), requested).toBe(true)
    }
  })
})

describe('local file links', () => {
  const safeName = fc.string({ minLength: 1, maxLength: 12 }).filter(name => !/[<>"|?*\u0000-\u001f\\/:]/.test(name) && name !== '.' && name !== '..' && name.trim() === name)
  const drivePath = fc.tuple(fc.constantFrom('C', 'd', 'E', 'z'), fc.array(safeName, { minLength: 1, maxLength: 5 }))

  it('a path survives the trip to a link and back', () => {
    fc.assert(fc.property(drivePath, ([drive, names]) => {
      const original = `${drive}:\\${names.join('\\')}`
      const url = localPathToFileUrl(original)
      expect(url).not.toBeNull()
      expect(fileUrlToLocalPath(url)).toBe(`${drive.toUpperCase()}:\\${names.join('\\')}`)
    }), fuzzParams({ numRuns: 1000 }))
  })

  it('whatever the renderer accepts as a local link, the main process accepts too, and nothing else does', () => {
    // The two sides check independently; a link one side lets through and the other refuses would
    // either do nothing or, worse, mean the checks differ.
    fc.assert(fc.property(fc.oneof(anyText, pathLike.map(value => `file:///C:/${value}`), pathLike.map(value => `C:\\${value}`)), (candidate) => {
      const local = fileUrlToLocalPath(candidate)
      if (local !== null) {
        const parsed = parseLocalFilePath(local)
        expect(parsed, `${candidate} -> ${local}`).not.toBeNull()
        expect(parsed.split(/[\\/]/)).not.toContain('..')
        expect(parsed).toMatch(/^[A-Za-z]:\\/)
        expect(parsed.slice(2)).not.toContain(':')
      }
      const direct = parseLocalFilePath(candidate)
      if (direct !== null) {
        expect(direct).toMatch(/^[A-Za-z]:\\/)
        expect(direct.startsWith('\\\\')).toBe(false)
        expect(direct.slice(2)).not.toContain(':')
        expect(direct.split(/[\\/]/)).not.toContain('..')
      }
    }), fuzzParams({ numRuns: 3000 }))
  })

  it('refuses network shares, device paths, streams and traversal in every form', () => {
    const bad = [
      '\\\\server\\share\\a.jpg', '//server/share/a.jpg', 'file://server/share/a.jpg', 'file:////server/share/a.jpg',
      '\\\\?\\C:\\a.jpg', '\\\\.\\PhysicalDrive0', 'C:\\a.jpg:stream', 'C:\\a:b\\c.jpg', 'C:a.jpg', 'C:\\..\\a.jpg', 'C:\\a\\..\\..\\b.jpg',
      'file:///C:/a/%2e%2e/b', 'file:///C:/a%2Fb', 'file:///C:/a%5Cb', 'file:///C:/%2e%2e/b', 'file:///C:/a/..', 'C:\\a?.jpg', 'C:\\a*.jpg', 'C:\\a\u0000.jpg'
    ]
    for (const candidate of bad) {
      expect(isLocalFileHref(candidate), candidate).toBe(false)
      expect(parseLocalFilePath(candidate), candidate).toBeNull()
    }
  })
})

describe('external links', () => {
  it('only web, mail and phone addresses are ever opened in the browser', () => {
    fc.assert(fc.property(fc.oneof(anyText, fc.webUrl(), fc.constantFrom('javascript:alert(1)', 'file:///C:/Windows/System32/calc.exe', 'ms-msdt:/id x', 'search-ms:query=a', 'steam://run/1')), (url) => {
      if (!isAllowedExternalUrl(url)) return
      expect(['http:', 'https:', 'mailto:', 'tel:']).toContain(new URL(url).protocol)
    }), fuzzParams({ numRuns: 1500 }))
  })

  it('the window only ever stays on its own page', () => {
    const appIndexUrl = 'file:///C:/Program%20Files/Tessera/resources/app.asar/out/renderer/index.html'
    fc.assert(fc.property(fc.oneof(anyText, fc.webUrl()), (url) => {
      const allowed = isAppNavigationUrl(url, { isDev: false, appIndexUrl })
      if (allowed) expect(decodeURIComponent(new URL(url).pathname).toLowerCase()).toBe(decodeURIComponent(new URL(appIndexUrl).pathname).toLowerCase())
    }), fuzzParams({ numRuns: 1500 }))
    expect(isAppNavigationUrl('https://example.com/', { isDev: false, appIndexUrl })).toBe(false)
    expect(isAppNavigationUrl('file:///C:/Users/me/evil.html', { isDev: false, appIndexUrl })).toBe(false)
  })
})

describe('imported archive entries', () => {
  it('flags every path that could leave the data directory, however it is written', () => {
    fc.assert(fc.property(pathLike, (entryPath) => {
      const [verdict] = findInvalidArchiveEntries([{ path: entryPath, text: '{}' }])
      const segments = entryPath.split(/[\\/]/)
      const escapes = /^([a-zA-Z]:|[\\/])/.test(entryPath) || segments.includes('..')
      if (escapes) expect(verdict?.reason).toBe('path')
    }), fuzzParams({ numRuns: 2000 }))
  })

  it('whatever an archive may contain, no accepted entry resolves outside the data directory', () => {
    fc.assert(fc.property(pathLike, (entryPath) => {
      if (findInvalidArchiveEntries([{ path: entryPath, text: '{}' }]).length > 0) return
      let resolved
      try {
        resolved = resolveSafePath(baseDir, entryPath)
      } catch {
        return // the file layer refuses it as well
      }
      expect(isPathInside(baseDir, resolved)).toBe(true)
    }), fuzzParams({ numRuns: 2000 }))
  })
})
