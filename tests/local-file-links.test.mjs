import { describe, expect, it, vi } from 'vitest'
import {
  fileUrlToLocalPath,
  isLocalFileHref,
  localPathLabel,
  localPathToFileUrl
} from '../src/renderer/src/utils/localFileLinks.js'
import {
  normalizeLinkHref,
  openLinkHref,
  resolveLinkTarget
} from '../src/renderer/src/components/TiptapEditor/editorHelpers.js'
import { buildContentExtensions } from '../src/renderer/src/components/TiptapEditor/contentExtensions.js'
import { createMarkdownParser, looksLikeMarkdown } from '../src/renderer/src/components/TiptapEditor/markdownPaste.js'
import { isSafeLink } from '../src/renderer/src/utils/richText.js'

const UNSAFE_PATHS = [
  '',
  'relative\\photo.jpg',
  '\\\\server\\share\\a.jpg', // network share
  '//server/share/a.jpg',
  '\\\\?\\C:\\a.jpg',
  'C:photo.jpg', // drive-relative
  'C:\\a\\..\\b.jpg',
  'C:\\a\\.\\b.jpg',
  'C:\\a\\b.jpg:evil.exe', // alternate data stream
  'C:\\a\\b?.jpg',
  'C:\\a\\<b>.jpg',
  'javascript:alert(1)',
  'file:///C:/a.jpg' // a URL is not a path
]

describe('local path <-> file URL', () => {
  it('turns Windows paths into file URLs, whatever the slashes', () => {
    expect(localPathToFileUrl('C:\\Users\\me\\Photos\\a.jpg')).toBe('file:///C:/Users/me/Photos/a.jpg')
    expect(localPathToFileUrl('d:/trip/a.jpg')).toBe('file:///D:/trip/a.jpg')
    expect(localPathToFileUrl('  C:\\a\\b.jpg  ')).toBe('file:///C:/a/b.jpg')
    expect(localPathToFileUrl('C:\\')).toBe('file:///C:/')
  })

  it('encodes spaces, brackets and non-ASCII names', () => {
    const url = localPathToFileUrl('C:\\照片\\摩托 (2026) #1.jpg')
    expect(url).not.toMatch(/[\s#]/)
    expect(fileUrlToLocalPath(url)).toBe('C:\\照片\\摩托 (2026) #1.jpg')
  })

  it('refuses paths that are not plain absolute drive paths', () => {
    for (const input of UNSAFE_PATHS.filter(input => !input.startsWith('file:'))) {
      expect(localPathToFileUrl(input)).toBeNull()
    }
  })

  it('reads a file URL back, and refuses anything but a drive path', () => {
    expect(fileUrlToLocalPath('file:///C:/a%20b/c.jpg')).toBe('C:\\a b\\c.jpg')
    for (const href of [
      'file://server/share/a.jpg',
      'file:////server/share/a.jpg',
      'file:///etc/passwd',
      'file:///C:/a/../b.jpg',
      'file:///C:/a%2F..%2Fb.jpg', // an encoded separator
      'file:///C:/a%5C..%5Cb.jpg',
      'file:///C:/a.jpg%3Aevil',
      'file:///C:/%E0%A4%A', // broken escape
      'https://example.com',
      null,
      undefined
    ]) {
      expect(fileUrlToLocalPath(href)).toBeNull()
    }
  })

  it('knows its own links, and labels them by file name', () => {
    expect(isLocalFileHref('file:///C:/a.jpg')).toBe(true)
    expect(isLocalFileHref('https://example.com')).toBe(false)
    expect(isSafeLink('file:///C:/a.jpg')).toBe(true)
    expect(isSafeLink('file://server/share/a.jpg')).toBe(false)
    expect(localPathLabel('C:\\Users\\me\\a.jpg')).toBe('a.jpg')
    expect(localPathLabel('C:\\')).toBe('C:')
  })
})

describe('link addresses in the editor', () => {
  it('stores web addresses and local paths, nothing else', () => {
    expect(normalizeLinkHref('https://example.com')).toBe('https://example.com')
    expect(normalizeLinkHref('www.example.com')).toBe('https://www.example.com')
    expect(normalizeLinkHref('C:\\Photos\\a.jpg')).toBe('file:///C:/Photos/a.jpg')
    expect(normalizeLinkHref('file:///C:/Photos/a%20b.jpg')).toBe('file:///C:/Photos/a%20b.jpg')
    for (const address of ['javascript:alert(1)', '\\\\server\\share', 'file://server/x', 'ftp://example.com', '', null]) {
      expect(normalizeLinkHref(address)).toBeNull()
    }
  })

  it('tells a click what a link points at', () => {
    expect(resolveLinkTarget('https://example.com')).toEqual({ kind: 'web', url: 'https://example.com' })
    expect(resolveLinkTarget('file:///C:/a%20b.jpg')).toEqual({ kind: 'file', path: 'C:\\a b.jpg' })
    expect(resolveLinkTarget('file://server/share/a.jpg')).toBeNull()
    expect(resolveLinkTarget('#anchor')).toBeNull()
  })
})

describe('following a link', () => {
  async function withApi(api, run) {
    globalThis.window = { api }
    try {
      return await run()
    } finally {
      delete globalThis.window
    }
  }

  it('opens web links in the browser and local paths through the main process', async () => {
    const openExternal = vi.fn()
    const openLocalFile = vi.fn().mockResolvedValue({ ok: true, mode: 'opened' })
    await withApi({ shell: { openExternal, openLocalFile } }, async () => {
      expect(openLinkHref('https://example.com', vi.fn())).toBe(true)
      expect(openLinkHref('file:///C:/a%20b.jpg', vi.fn())).toBe(true)
      expect(openLinkHref('javascript:alert(1)', vi.fn())).toBe(false)
    })
    expect(openExternal).toHaveBeenCalledWith('https://example.com')
    expect(openLocalFile).toHaveBeenCalledWith('C:\\a b.jpg')
    expect(openLocalFile).toHaveBeenCalledTimes(1)
  })

  it('says what went wrong, or what was done instead', async () => {
    const showToast = vi.fn()
    const results = [
      { ok: false, error: 'not-found' },
      { ok: true, mode: 'revealed' },
      { ok: true, mode: 'opened' }
    ]
    const openLocalFile = vi.fn(() => Promise.resolve(results.shift()))
    await withApi({ shell: { openLocalFile } }, async () => {
      for (let i = 0; i < 3; i += 1) {
        openLinkHref('file:///C:/a.jpg', showToast)
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    })
    expect(showToast).toHaveBeenCalledTimes(2)
    expect(showToast.mock.calls[0][0]).toContain('找不到')
    expect(showToast.mock.calls[0][1]).toBe('error')
    expect(showToast.mock.calls[1][1]).toBe('info')
  })
})

describe('local paths in pasted Markdown', () => {
  const parse = createMarkdownParser(buildContentExtensions())
  const linksOf = (doc) => {
    const found = []
    const walk = (node) => {
      for (const mark of node.marks || []) if (mark.type === 'link') found.push([node.text, mark.attrs.href])
      for (const child of node.content || []) walk(child)
    }
    walk(doc)
    return found
  }

  it('turns a path into a file link, with <angle brackets> for spaces', () => {
    expect(looksLikeMarkdown('[照片](C:\\Photos\\a.jpg)')).toBe(true)
    expect(linksOf(parse('[照片](C:\\Photos\\a.jpg)'))).toEqual([['照片', 'file:///C:/Photos/a.jpg']])
    expect(linksOf(parse('[照片](<C:\\My Photos\\a b.jpg>)'))).toEqual([['照片', 'file:///C:/My%20Photos/a%20b.jpg']])
    expect(linksOf(parse('[照片](file:///C:/Photos/a.jpg)'))).toEqual([['照片', 'file:///C:/Photos/a.jpg']])
  })

  it('keeps a local image as a link to the file', () => {
    expect(linksOf(parse('![封面](C:\\Photos\\a.jpg)'))).toEqual([['封面', 'file:///C:/Photos/a.jpg']])
  })

  it('still drops network shares, other drives schemes and unsafe links', () => {
    const doc = parse('[a](\\\\server\\share\\a.jpg) [b](file://server/share/a.jpg) [c](file:///C:/a/../b.jpg) [d](javascript:alert(1))')
    expect(linksOf(doc)).toEqual([])
  })
})
