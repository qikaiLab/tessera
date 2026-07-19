import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve('src/renderer/src/pages/Today.css'), 'utf8')
const component = fs.readFileSync(path.resolve('src/renderer/src/pages/Today.jsx'), 'utf8')

describe('today page transition contract', () => {
  it('removes the hard-coded date flash while retaining content transitions', () => {
    expect(css).not.toContain('.today-date-flow')
    expect(css).not.toContain('dateFlowNext')
    expect(component).not.toContain('today-date-flow')
    expect(css).toContain('@keyframes dateSlideNext')
    expect(css).toContain('@keyframes recordCardNext')
  })

  it('animates the return-to-today button before unmounting it', () => {
    expect(css).toContain('.today-return-button.is-leaving')
    expect(css).toContain('@keyframes returnToTodayOut')
    expect(component).toContain('returningToToday')
  })
})
