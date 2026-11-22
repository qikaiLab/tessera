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

  it('hides the toolbar while the menu is open', () => {
    expect(menu).toContain('setContextMenuOpen(Boolean(request))')
    expect(toolbar).toContain('useContextMenuOpen()')
    expect(toolbar).toContain("visible && !contextMenuOpen ? 'is-visible'")
  })
})
