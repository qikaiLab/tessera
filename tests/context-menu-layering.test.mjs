import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/source.mjs'

const toolbar = readSource('src/renderer/src/components/TiptapEditor/BubbleToolbar.jsx')
const menu = readSource('src/renderer/src/components/ContextMenu.jsx')
const menuCss = readSource('src/renderer/src/components/ContextMenu.css')

describe('context menu and the editor format toolbar', () => {
  it('draws the context menu above the toolbar', () => {
    const toolbarLayer = Number(toolbar.match(/zIndex:\s*(\d+)/)?.[1])
    const menuLayer = Number(menuCss.match(/\.app-context-menu\s*\{[^}]*z-index:\s*(\d+)/s)?.[1])
    expect(toolbarLayer).toBeGreaterThan(0)
    expect(menuLayer).toBeGreaterThan(toolbarLayer)
  })

  it('puts the menu in the body, next to the toolbar, so their z-indexes are comparable', () => {
    expect(toolbar).toContain('createPortal(toolbar, document.body)')
    expect(menu).toContain('document.body')
    expect(menu).toContain('createPortal(')
  })

  it('frosts whatever shows through the semi-transparent menu', () => {
    expect(menuCss).toMatch(/\.app-context-menu\s*\{[^}]*backdrop-filter:\s*var\(--context-menu-backdrop\)/s)
    const tokens = readSource('src/renderer/src/styles/tokens.css')
    expect(tokens).toMatch(/--context-menu-backdrop:\s*blur\(/)
    // Mostly opaque in the default style, so the frost reads as one surface.
    for (const theme of ['dark', 'light']) {
      const block = tokens.match(new RegExp(`\\[data-interface-style='default'\\]\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? ''
      const alpha = Number(block.match(/--context-menu-background:\s*rgba\([^)]*,\s*([\d.]+)\)/)?.[1])
      expect(alpha).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('hides the toolbar while the menu is open', () => {
    expect(menu).toContain('setContextMenuOpen(Boolean(request))')
    expect(toolbar).toContain('useContextMenuOpen()')
    expect(toolbar).toContain("visible && !contextMenuOpen ? 'is-visible'")
  })
})
