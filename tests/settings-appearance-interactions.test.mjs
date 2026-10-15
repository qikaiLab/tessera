import { describe, expect, it } from 'vitest'
import { readSource, readTree } from './helpers/source.mjs'

const component = readTree('src/renderer/src/pages/Settings', ['.jsx', '.js'])
const css = readTree('src/renderer/src/pages/Settings', ['.css'])
const appContext = readSource('src/renderer/src/context/AppContext.jsx')

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

  it('shows managed background controls only for Frosted Glass', () => {
    expect(component).toContain('interfaceStyle === INTERFACE_STYLE_IDS.FROSTED_GLASS')
    expect(component).toContain('importFrostedBackground')
    expect(component).toContain('clearFrostedBackground')
    expect(component).toContain('frostedBackgroundUrl || defaultFrostedBackground')
    expect(component).toContain('frostedBackgroundBlur')
    expect(component).toContain('updateFrostedBackgroundBlur')
    expect(component).toContain('min={FROSTED_BACKGROUND_BLUR.MIN}')
    expect(css).toContain('.appearance-background-panel')
    expect(css).toContain('filter: blur(var(--frosted-preview-blur))')
    expect(css).toContain('.appearance-background-blur-control')
    expect(appContext).toContain("window.api.config.set('frostedBackgroundBlur', next)")
    expect(appContext).toContain('normalizeFrostedBackgroundBlur(cfg.frostedBackgroundBlur)')
  })
})
