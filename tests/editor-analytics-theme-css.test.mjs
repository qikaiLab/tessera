import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const notesCss = fs.readFileSync(path.resolve('src/renderer/src/pages/Notes.css'), 'utf8')
const surfacesCss = fs.readFileSync(path.resolve('src/renderer/src/theme/appearanceSurfaces.css'), 'utf8')
const editorCss = fs.readFileSync(
  path.resolve('src/renderer/src/components/TiptapEditor/TiptapEditor.css'),
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
