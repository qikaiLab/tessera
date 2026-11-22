import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/source.mjs'

const calendar = readSource('src/renderer/src/pages/Calendar/Calendar.css')
const tokens = readSource('src/renderer/src/styles/tokens.css')

describe('calendar days with records', () => {
  it('reads their card look from tokens, falling back to the old subtle surface', () => {
    expect(calendar).toMatch(/\.cal-day\.has-data\s*\{[^}]*background:\s*var\(--calendar-day-data-background,\s*var\(--bg-surface-2\)\)/s)
    expect(calendar).toMatch(/\.cal-day\.has-data\s*\{[^}]*border-color:\s*var\(--calendar-day-data-border,\s*transparent\)/s)
  })

  it('stands out from the page in the default light style with a white card and a hairline edge', () => {
    // Other tokens may share the selector, so read every block that has it.
    const block = [...tokens.matchAll(/\[data-interface-style='default'\]\[data-theme='light'\]\s*\{([^}]*)\}/g)]
      .map(match => match[1]).join('\n')
    expect(block).toContain('--calendar-day-data-background: var(--bg-surface)')
    expect(block).toContain('--calendar-day-data-border: var(--border-hover)')
  })
})
