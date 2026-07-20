import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const cssPath = path.resolve('src/renderer/src/styles/global.css')
const css = fs.readFileSync(cssPath, 'utf8')
const appCss = fs.readFileSync(path.resolve('src/renderer/src/styles/App.css'), 'utf8')
const editorCss = fs.readFileSync(
  path.resolve('src/renderer/src/components/TiptapEditor/TiptapEditor.css'),
  'utf8'
)

function getRule(selector) {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = css.indexOf('\n}', start)
  expect(end).toBeGreaterThan(start)
  return css.slice(start, end)
}

function getHexVariable(rule, name) {
  return rule.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]
}

function expectNeutralHex(value) {
  expect(value).toMatch(/^#[0-9a-f]{6}$/i)
  const channels = value.slice(1).match(/.{2}/g).map(channel => Number.parseInt(channel, 16))
  expect(new Set(channels).size).toBe(1)
}

describe('appearance theme CSS contract', () => {
  it('keeps every default background surface neutral in dark and light modes', () => {
    for (const selector of ["[data-theme='dark']", "[data-theme='light']"]) {
      const rule = getRule(selector)
      for (const variable of [
        '--bg-app',
        '--bg-sidebar',
        '--bg-surface',
        '--bg-surface-2',
        '--bg-surface-3',
        '--bg-hover',
        '--bg-active',
        '--bg-input'
      ]) {
        expectNeutralHex(getHexVariable(rule, variable))
      }
    }
  })

  it('defines semantic resident and activated tag roles for every fixed style', () => {
    for (const selector of [
      "[data-interface-style='linen-study']",
      "[data-interface-style='jade-archive']",
      "[data-interface-style='frosted-glass'][data-theme='dark']",
      "[data-interface-style='frosted-glass'][data-theme='light']"
    ]) {
      const rule = getRule(selector)
      expect(rule).toContain('--tag-resident-text:')
      expect(rule).toContain('--tag-resident-bg:')
      expect(rule).toContain('--tag-activated-text:')
      expect(rule).toContain('--tag-activated-bg:')
    }
  })

  it('keeps material and fullscreen styling behind theme-level tokens', () => {
    expect(css).toContain('--surface-material-image:')
    expect(css).toContain('--surface-material-subtle-image:')
    expect(css).toContain('--editor-fullscreen-background:')
    expect(css).not.toContain('rgb(17, 17, 18)')
    expect(css).not.toContain('rgb(245, 245, 247)')
  })

  it('uses dedicated cover-sized fullscreen writing assets for fixed styles', () => {
    const linenAsset = path.resolve('src/renderer/src/assets/themes/linen-fullscreen-background.png')
    const jadeAsset = path.resolve('src/renderer/src/assets/themes/jade-fullscreen-background.png')
    expect(fs.existsSync(linenAsset)).toBe(true)
    expect(fs.existsSync(jadeAsset)).toBe(true)
    expect(css).toContain("url('../assets/themes/linen-fullscreen-background.png') center / cover no-repeat")
    expect(css).toContain("url('../assets/themes/jade-fullscreen-background.png') center / cover no-repeat")
  })

  it('defines a generated default background and adaptive light and dark glass recipes', () => {
    const frostedAsset = path.resolve('src/renderer/src/assets/themes/frosted-glass-background.png')
    expect(fs.existsSync(frostedAsset)).toBe(true)
    expect(css).toContain("url('../assets/themes/frosted-glass-background.png')")
    expect(css).toContain("[data-interface-style='frosted-glass'][data-theme='dark']")
    expect(css).toContain("[data-interface-style='frosted-glass'][data-theme='light']")
    expect(css).toContain('--frosted-accent-h:')
    expect(css).toContain('--frosted-background-blur:')
    expect(appCss).toContain('background-image: var(--frosted-background-image)')
    expect(appCss).toContain('filter: blur(var(--frosted-background-blur))')
  })

  it('keeps frosted glass surfaces neutral while accents remain background-adaptive', () => {
    for (const selector of [
      "[data-interface-style='frosted-glass'][data-theme='dark']",
      "[data-interface-style='frosted-glass'][data-theme='light']"
    ]) {
      const rule = getRule(selector)
      for (const variable of [
        '--bg-app',
        '--bg-sidebar',
        '--bg-surface',
        '--bg-surface-2',
        '--bg-surface-3',
        '--bg-hover',
        '--bg-active',
        '--bg-input',
        '--bg-glass'
      ]) {
        const match = rule.match(new RegExp(`${variable}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),`))
        expect(match, `${selector} ${variable}`).toBeTruthy()
        expect(new Set(match.slice(1, 4)).size, `${selector} ${variable}`).toBe(1)
      }
      expect(rule).toContain('hsl(var(--frosted-accent-h)')
    }
  })

  it('keeps fullscreen positioning independent from the frosted shell blur layer', () => {
    expect(appCss).toContain("[data-interface-style='frosted-glass'] .app-main::before")
    expect(appCss).not.toMatch(
      /\[data-interface-style='frosted-glass'\][^{]*\.app-main[^:][^{]*\{[^}]*backdrop-filter:/s
    )
  })

  it('renders a continuous frosted fullscreen background behind transparent editor regions', () => {
    expect(editorCss).toContain("[data-interface-style='frosted-glass'] .tiptap-fullscreen::before")
    expect(editorCss).toContain('background: var(--frosted-fullscreen-overlay)')
    expect(editorCss).toMatch(
      /\[data-interface-style='frosted-glass'\] \.tiptap-fullscreen \.tiptap-editor-wrapper\s*\{[^}]*background:\s*transparent;/s
    )
    expect(editorCss).toMatch(
      /\[data-interface-style='frosted-glass'\] \.tiptap-fullscreen-header\s*\{[^}]*background:\s*transparent;/s
    )
    expect(appCss).toMatch(
      /body\.editor-fullscreen-active \.titlebar\s*\{[^}]*z-index:\s*1300 !important;/s
    )
    expect(appCss).toMatch(
      /body\.editor-fullscreen-active \.titlebar\s*\{[^}]*backdrop-filter:\s*none;/s
    )
    expect(appCss).toMatch(
      /body\.editor-fullscreen-active \.titlebar::before,[^}]*opacity:\s*0;/s
    )
  })

  it('keeps the Jade Archive base surfaces above near-black values', () => {
    const jadeRule = getRule("[data-interface-style='jade-archive']")
    expect(getHexVariable(jadeRule, '--bg-app')).toBe('#141c17')
    expect(getHexVariable(jadeRule, '--bg-surface')).toBe('#1c2821')
    expect(jadeRule).not.toContain('#0b0f0d')
  })

  it('keeps generated textures and user typography behind theme-level tokens', () => {
    expect(css).toContain("url('../assets/themes/linen-paper-texture.png')")
    expect(css).toContain("url('../assets/themes/jade-stone-texture.png')")
    expect(css).toContain("[data-interface-font='theme']")
    expect(css).toContain("[data-interface-weight='heavy']")
  })

  it('defines semantic editor, floating toolbar, and chart tooltip surfaces', () => {
    for (const token of [
      '--editor-title-background:',
      '--floating-toolbar-background:',
      '--floating-toolbar-hover-background:',
      '--floating-toolbar-active-background:',
      '--chart-tooltip-background:',
      '--chart-tooltip-text:',
      '--chart-tooltip-border:'
    ]) {
      expect(css).toContain(token)
    }
  })
})
