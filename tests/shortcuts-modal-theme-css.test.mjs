import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = file => fs.readFileSync(path.resolve(file), 'utf8')
const modalCss = read('src/renderer/src/components/ShortcutsModal.css')
const globalCss = read('src/renderer/src/styles/global.css')

describe('shortcuts modal theming', () => {
  it('only references theme variables that global.css actually defines', () => {
    const used = [...modalCss.matchAll(/var\((--[\w-]+)/g)].map(match => match[1])
    const undefinedVariables = [...new Set(used)].filter(
      name => !new RegExp(`${name}\s*:`).test(globalCss)
    )
    // An undefined variable silently falls back to its dark hard-coded colour in every
    // theme, which made the list near-black on the light styles.
    expect(undefinedVariables).toEqual([])
  })

  it('has a frosted glass treatment for both colour schemes', () => {
    expect(modalCss).toContain("[data-interface-style='frosted-glass'] .shortcuts-modal")
    expect(modalCss).toContain("[data-theme='light'] .shortcuts-modal")
  })
})
