import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const component = fs.readFileSync(path.resolve('src/renderer/src/pages/Settings.jsx'), 'utf8')
const css = fs.readFileSync(path.resolve('src/renderer/src/pages/Settings.css'), 'utf8')

describe('settings appearance interaction contract', () => {
  it('defers pointer-driven interface zoom until the drag finishes', () => {
    expect(component).toContain('interfaceZoomPointerActiveRef')
    expect(component).toContain('value={interfaceZoomDraft}')
    expect(component).toContain('onPointerDown=')
    expect(component).toContain('onPointerUp=')
    expect(component).toContain('onPointerCancel={cancelInterfaceZoomDrag}')
    expect(component).not.toContain('onChange={event => updateInterfaceZoom(event.target.value)}')
  })

  it('lays out all default accent options as a four-column grid', () => {
    expect(css).toMatch(/\.appearance-accent-options\s*\{[^}]*display:\s*grid/s)
    expect(css).toMatch(/\.appearance-accent-options\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s)
  })
})
