import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ABOUT_INFO,
  ABOUT_LINKS,
  CO_DEVELOPERS,
  THIRD_PARTY,
  buildVersionReport,
  readRuntimeVersions
} from '../src/renderer/src/components/about/aboutInfo.js'
import {
  FRESH_INSTALL_APPEARANCE,
  INTERFACE_STYLE_IDS,
  THEME_ACCENT_IDS,
  isFreshInstallConfig
} from '../src/renderer/src/theme/appearanceRegistry.js'

describe('about dialog content', () => {
  it('links only to https pages', () => {
    for (const link of [...ABOUT_LINKS, ...CO_DEVELOPERS, ...THIRD_PARTY.map(item => ({ url: item.url }))]) {
      expect(new URL(link.url).protocol).toBe('https:')
    }
  })

  it('gives every link a label and an icon for its tile', () => {
    for (const link of ABOUT_LINKS) {
      expect(link.label).toBeTruthy()
      expect(link.icon).toBeTruthy()
    }
    expect(new Set(ABOUT_LINKS.map(link => link.id)).size).toBe(ABOUT_LINKS.length)
  })

  it('shows the group number, the homepage and the support page the author gave', () => {
    expect(ABOUT_INFO.authorName).toBe('7k')
    expect(ABOUT_INFO.qqGroup).toBe('1132171117')
    expect(ABOUT_LINKS.find(link => link.id === 'homepage').url).toBe('https://qikailab.github.io')
    expect(ABOUT_LINKS.find(link => link.id === 'support').url).toBe('https://ifdian.net/a/7klab')
  })

  it('names the AI assistants that build the app with the author', () => {
    expect(CO_DEVELOPERS.map(dev => `${dev.name} (${dev.maker})`)).toEqual(['Claude (Anthropic)', 'Codex (OpenAI)'])
    expect(new Set(CO_DEVELOPERS.map(dev => dev.id)).size).toBe(CO_DEVELOPERS.length)
  })

  it('reads the runtime versions from the user agent and builds a bug-report text', () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Tessera/0.4.0 Chrome/150.0.1.2 Electron/43.8.7 Safari/537.36'
    const runtime = readRuntimeVersions(userAgent)
    expect(runtime).toEqual({ electron: '43.8.7', chromium: '150.0.1.2' })
    expect(buildVersionReport({ version: '0.4.0', runtime, platform: 'Win32' }))
      .toBe(`${ABOUT_INFO.appName} v0.4.0\nElectron 43.8.7\nChromium 150.0.1.2\nWin32`)
    expect(readRuntimeVersions('')).toEqual({ electron: null, chromium: null })
  })
})

describe('first-launch appearance', () => {
  it('is the light default style in pine green', () => {
    expect(FRESH_INSTALL_APPEARANCE).toEqual({
      interfaceStyle: INTERFACE_STYLE_IDS.DEFAULT,
      theme: 'light',
      themeAccent: THEME_ACCENT_IDS.FOREST
    })
  })

  it('applies only to a configuration that has never been used', () => {
    expect(isFreshInstallConfig({})).toBe(true)
    expect(isFreshInstallConfig({ dataDir: 'D:\\data' })).toBe(true)
    expect(isFreshInstallConfig({ onboardingDone: true })).toBe(false)
    expect(isFreshInstallConfig({ theme: 'dark' })).toBe(false)
    expect(isFreshInstallConfig({ themeAccent: 'violet' })).toBe(false)
    expect(isFreshInstallConfig({ interfaceStyle: 'default' })).toBe(false)
  })
})

describe('licence', () => {
  const root = process.cwd()
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const packageLock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  const licenseText = readFileSync(join(root, 'LICENSE'), 'utf8')

  it('is PolyForm Noncommercial 1.0.0 in the licence file, the package files and the dialog', () => {
    expect(licenseText).toContain('# PolyForm Noncommercial License 1.0.0')
    expect(licenseText).toMatch(/^Required Notice: Copyright /)
    expect(packageJson.license).toBe('PolyForm-Noncommercial-1.0.0')
    expect(packageLock.packages[''].license).toBe(packageJson.license)
    expect(ABOUT_INFO.license).toBe('PolyForm Noncommercial 1.0.0')
    expect(ABOUT_INFO.licenseUrl).toBe('https://polyformproject.org/licenses/noncommercial/1.0.0')
  })

  it('credits the same AI assistants in the README as in the dialog', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8')
    for (const dev of CO_DEVELOPERS) {
      expect(readme).toContain(`**[${dev.name}](${dev.url})**（${dev.maker}）`)
    }
  })

  it('keeps the README from calling the project open source', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8')
    expect(readme).toContain('PolyForm Noncommercial License 1.0.0')
    expect(readme).not.toMatch(/MIT License|license-MIT/)
  })
})
