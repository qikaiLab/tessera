import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useOverlayDismiss } from '../src/renderer/src/utils/useModalA11y.js'

// The handlers a dimmed overlay gets, taken out of one render of the hook.
function overlayProps(onDismiss) {
  let props
  function Probe() {
    props = useOverlayDismiss(onDismiss)
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return props
}

const overlay = {}
const box = {}
const press = (props, target) => props.onMouseDown({ target, currentTarget: overlay })
const release = (props, target) => props.onClick({ target, currentTarget: overlay })

describe('closing a dialog by clicking its overlay', () => {
  it('counts a click that both began and ended on the overlay', () => {
    const onDismiss = vi.fn()
    const props = overlayProps(onDismiss)
    press(props, overlay)
    release(props, overlay)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not count a text selection dragged out of a field and let go over the overlay', () => {
    const onDismiss = vi.fn()
    const props = overlayProps(onDismiss)
    press(props, box)
    release(props, overlay)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('does not count a click inside the dialog, or one that never began on the overlay', () => {
    const onDismiss = vi.fn()
    const props = overlayProps(onDismiss)
    press(props, box)
    release(props, box)
    release(props, overlay)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('needs a fresh press for every click', () => {
    const onDismiss = vi.fn()
    const props = overlayProps(onDismiss)
    press(props, overlay)
    release(props, overlay)
    release(props, overlay)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
