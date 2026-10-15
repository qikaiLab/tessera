import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readStylesheet } from './helpers/source.mjs'
import {
  clampMenuPosition,
  nextEnabledMenuIndex,
  normalizeContextMenuItems
} from '../src/renderer/src/utils/contextMenuModel.js'

const contextMenuSource = fs.readFileSync(
  path.resolve('src/renderer/src/utils/contextMenu.js'),
  'utf8'
)
const contextMenuComponent = fs.readFileSync(
  path.resolve('src/renderer/src/components/ContextMenu.jsx'),
  'utf8'
)
const contextMenuCss = fs.readFileSync(
  path.resolve('src/renderer/src/components/ContextMenu.css'),
  'utf8'
)
const globalCss = readStylesheet('src/renderer/src/styles/global.css')

describe('application context menu model', () => {
  it('removes hidden commands and redundant separators', () => {
    expect(normalizeContextMenuItems([
      { type: 'separator' },
      { id: 'copy', label: '复制文本' },
      { type: 'separator' },
      { type: 'separator' },
      { id: 'hidden', label: '隐藏', visible: false },
      { id: 'paste', label: '粘贴' },
      { type: 'separator' }
    ])).toEqual([
      { id: 'copy', label: '复制文本' },
      { type: 'separator' },
      { id: 'paste', label: '粘贴' }
    ])
  })

  it('clamps the menu inside the app viewport and below the title bar', () => {
    expect(clampMenuPosition({
      x: 790,
      y: 590,
      width: 220,
      height: 240,
      viewportWidth: 800,
      viewportHeight: 600,
      inset: 8,
      topInset: 44
    })).toEqual({ left: 572, top: 352 })

    expect(clampMenuPosition({
      x: -20,
      y: 4,
      width: 220,
      height: 240,
      viewportWidth: 800,
      viewportHeight: 600,
      inset: 8,
      topInset: 44
    })).toEqual({ left: 8, top: 44 })
  })

  it('skips separators and disabled items during keyboard navigation', () => {
    const items = [
      { id: 'undo', enabled: false },
      { type: 'separator' },
      { id: 'copy', enabled: true },
      { id: 'paste', enabled: false },
      { id: 'select-all', enabled: true }
    ]
    expect(nextEnabledMenuIndex(items, -1, 1)).toBe(2)
    expect(nextEnabledMenuIndex(items, 2, 1)).toBe(4)
    expect(nextEnabledMenuIndex(items, 4, -1)).toBe(2)
  })
})

describe('application context menu integration contract', () => {
  it('uses the custom host by default while retaining the native emergency fallback', () => {
    expect(contextMenuSource).toContain('menuSubscribers.size > 0')
    expect(contextMenuSource).toContain("window.api?.contextMenu?.show?.({")
    expect(contextMenuComponent).toContain('subscribeContextMenu')
    expect(contextMenuComponent).toContain('activateContextMenuItem')
  })

  it('preserves selection and provides accessible close and navigation behavior', () => {
    expect(contextMenuSource).toContain('captureEditableSelection')
    expect(contextMenuSource).toContain('restoreEditableSelection')
    expect(contextMenuComponent).toContain("event.key === 'Escape'")
    expect(contextMenuComponent).toContain("event.key === 'ArrowDown'")
    expect(contextMenuComponent).toContain('role="menu"')
  })

  it('styles all visual states through semantic theme tokens', () => {
    expect(contextMenuCss).toContain('var(--context-menu-background)')
    expect(contextMenuCss).toContain('var(--context-menu-hover-background)')
    expect(contextMenuCss).toContain('var(--context-menu-disabled-text)')
    expect(contextMenuCss).toContain('var(--context-menu-danger-background)')
    expect(globalCss).toContain("[data-interface-style='linen-study']")
    expect(globalCss).toContain("[data-interface-style='jade-archive']")
    expect(globalCss).toContain('--context-menu-background-image: var(--surface-material-subtle-image)')
  })

  it('uses compact intrinsic sizing without shrinking menu item hit targets', () => {
    expect(contextMenuComponent).toContain('const ESTIMATED_WIDTH = 148')
    expect(contextMenuCss).toContain('width: max-content')
    expect(contextMenuCss).toContain('min-width: 136px')
    expect(contextMenuCss).toContain('max-width: min(260px, calc(100vw - 16px))')
    expect(contextMenuCss).toContain('min-height: 32px')
  })
})
