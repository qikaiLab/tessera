import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readTree } from './helpers/source.mjs'

const notesCss = readTree('src/renderer/src/pages/Notes', ['.css'])
const notesDrawerCss = readTree('src/renderer/src/components/NotesDrawer', ['.css'])
const surfacesCss = fs.readFileSync(path.resolve('src/renderer/src/theme/appearanceSurfaces.css'), 'utf8')
const editorCss = fs.readFileSync(
  path.resolve('src/renderer/src/components/TiptapEditor/TiptapEditor.css'),
  'utf8'
)
const editorComponent = fs.readFileSync(
  path.resolve('src/renderer/src/components/TiptapEditor/index.jsx'),
  'utf8'
)
const analyticsComponent = fs.readFileSync(path.resolve('src/renderer/src/pages/Analytics.jsx'), 'utf8')
const analyticsCss = fs.readFileSync(path.resolve('src/renderer/src/pages/Analytics.css'), 'utf8')

describe('editor and analytics theme CSS contract', () => {
  it('keeps the note title on its semantic transparent editor surface', () => {
    expect(notesCss).toContain('background-color: var(--editor-title-background)')
    expect(notesCss).toContain('background-image: var(--editor-title-background-image)')
    expect(notesCss).toContain('caret-color: var(--accent)')
    expect(surfacesCss).not.toMatch(/\.input,\s*\.notes-title-input,/)
  })

  it('keeps the note drawer title on the same semantic transparent surface', () => {
    expect(notesDrawerCss).toContain('background-color: var(--editor-title-background)')
    expect(notesDrawerCss).toContain('background-image: var(--editor-title-background-image)')
    expect(notesDrawerCss).toContain('caret-color: var(--accent)')
    expect(notesDrawerCss).toContain('color: var(--editor-title-placeholder)')
    expect(surfacesCss).not.toMatch(/\.input,\s*\.notes-drawer-title-input,/)
  })

  it('keeps note actions aligned while truncating only the title at narrow widths', () => {
    expect(notesCss).toContain('container-name: notes-editor')
    expect(notesCss).toContain('container-type: inline-size')
    expect(notesCss).toContain('@container notes-editor (max-width: 720px)')
    expect(notesCss).toContain('grid-template-columns: minmax(0, 1fr) max-content')
    expect(notesCss).toContain('text-overflow: ellipsis')
    expect(notesCss).toContain('white-space: nowrap')
    expect(notesCss).toContain('flex-wrap: nowrap')
    expect(notesCss).not.toContain('grid-template-columns: minmax(0, 1fr);\n    align-items: start')
    expect(notesCss).not.toContain('justify-content: flex-start')
  })

  it('separates the note list with a semantic material edge', () => {
    expect(surfacesCss).toContain('background-color: var(--notes-list-background)')
    expect(surfacesCss).toContain('background-image: var(--notes-list-material-image)')
    expect(surfacesCss).toContain('border-inline-end: 1px solid var(--notes-list-divider)')
    expect(surfacesCss).toContain('box-shadow: var(--notes-list-edge-shadow)')
    expect(surfacesCss).toContain('backdrop-filter: var(--glass-backdrop-ambient)')
  })

  it('keeps the exit button beside the window controls and the header clear of them', () => {
    // The button lives outside the header (whose entrance animation would trap a fixed child).
    expect(editorComponent).toMatch(/tiptap-fullscreen-header-actions[\s\S]*fullscreen-exit-btn/)
    expect(editorComponent).toContain("'--fs-column-max': currentMaxWidth")
    expect(editorCss).toMatch(/\.tiptap-fullscreen \.fullscreen-exit-btn\s*\{[^}]*position:\s*fixed;[^}]*right:\s*calc\(var\(--window-controls-width\) \+ 16px\)/)
    expect(editorCss).toContain('var(--fs-controls-reserve)')
    expect(editorCss).toContain('white-space: nowrap')
    expect(editorCss).toContain('@media (max-width: 1024px)')
    expect(editorCss).not.toContain('padding: 48px 20px 8px')
  })

  it('styles every bubble toolbar state through semantic theme tokens', () => {
    expect(editorCss).toContain('background-color: var(--floating-toolbar-background)')
    expect(editorCss).toContain('background: var(--floating-toolbar-hover-background)')
    expect(editorCss).toContain('background: var(--floating-toolbar-active-background)')
    expect(editorCss).toContain('background: var(--floating-toolbar-separator)')
    expect(editorCss).not.toContain('rgba(28, 28, 31, 0.72)')
  })

  it('gives pie labels safe drawing margins and shares readable tooltip tokens', () => {
    expect(analyticsComponent).toContain('className="analytics-pie-chart"')
    expect(analyticsComponent).toContain('margin={{ top: 20, right: 36, bottom: 20, left: 36 }}')
    expect(analyticsComponent).toContain("itemStyle: { color: 'var(--chart-tooltip-text)' }")
    expect(analyticsCss).toContain('.analytics-chart-area .recharts-default-tooltip')
    expect(analyticsCss).toContain('color: var(--chart-tooltip-text) !important')
  })

  it('keeps every chart inside the same fixed card content geometry', () => {
    expect(analyticsCss).toContain('flex: 0 0 32px')
    expect(analyticsCss).toContain('height: 220px')
    expect(analyticsCss).toContain('flex: 0 0 220px')
    expect(analyticsComponent).not.toContain('height={240}')
  })
})
