import { describe, expect, it } from 'vitest'
import { readTree } from './helpers/source.mjs'

const css = readTree('src/renderer/src/pages/Today', ['.css'])
const component = readTree('src/renderer/src/pages/Today', ['.jsx', '.js'])

describe('today page transition contract', () => {
  it('removes the hard-coded date flash while retaining content transitions', () => {
    expect(css).not.toContain('.today-date-flow')
    expect(css).not.toContain('dateFlowNext')
    expect(component).not.toContain('today-date-flow')
    expect(css).toContain('@keyframes dateSlideNext')
    expect(css).toContain('@keyframes recordCardNext')
  })

  it('keeps the date and return-button geometry stable', () => {
    expect(css).toContain('.today-date-group')
    expect(css).toMatch(/\.today-date-group\s*\{[^}]*width:\s*188px/s)
    expect(css).toMatch(/\.today-return-slot\s*\{[^}]*width:\s*108px/s)
    expect(component).toContain('<div className="today-return-slot">')
  })

  it('animates both return-to-today button directions before unmounting it', () => {
    expect(css).toContain('.today-return-button.is-entering')
    expect(css).toContain('.today-return-button.is-leaving')
    expect(css).toContain('@keyframes returnToTodayIn')
    expect(css).toContain('@keyframes returnToTodayOut')
    expect(component).toContain("transitionReturnTodayButton('entering', 'visible')")
    expect(component).toContain("transitionReturnTodayButton('leaving', 'hidden')")
    expect(component).toContain("returnTodayPhase !== 'hidden'")
  })
})
