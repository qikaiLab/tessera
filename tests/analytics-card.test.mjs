import { describe, expect, it } from 'vitest'
import {
  getDrawnBindings,
  getHeatmapDays,
  getMetricForSection,
  moveBindingToFront,
  setBoundSections
} from '../src/renderer/src/utils/analyticsCard.js'

const sections = [
  { id: 'diary', type: 'text' },
  { id: 'running', type: 'number' },
  { id: 'mood', type: 'number' }
]

describe('analytics card bindings', () => {
  it('picks the metric from the section type', () => {
    expect(getMetricForSection(sections[0])).toBe('wordcount')
    expect(getMetricForSection(sections[1])).toBe('value')
  })

  it('keeps existing bindings in order and appends newly picked sections', () => {
    const bindings = [
      { sectionId: 'running', metric: 'value' },
      { sectionId: 'diary', metric: 'wordcount' }
    ]
    expect(setBoundSections(bindings, ['diary', 'running', 'mood'], sections)).toEqual([
      { sectionId: 'running', metric: 'value' },
      { sectionId: 'diary', metric: 'wordcount' },
      { sectionId: 'mood', metric: 'value' }
    ])
  })

  it('removes unpicked sections and ignores unknown ids', () => {
    const bindings = [
      { sectionId: 'running', metric: 'value' },
      { sectionId: 'diary', metric: 'wordcount' }
    ]
    expect(setBoundSections(bindings, ['diary', 'ghost'], sections)).toEqual([
      { sectionId: 'diary', metric: 'wordcount' }
    ])
    expect(setBoundSections(undefined, [], sections)).toEqual([])
  })

  it('draws only the first binding on a heatmap but never drops the others', () => {
    const bindings = [
      { sectionId: 'running', metric: 'value' },
      { sectionId: 'diary', metric: 'wordcount' }
    ]
    expect(getDrawnBindings({ type: 'heatmap', bindings })).toEqual([bindings[0]])
    expect(getDrawnBindings({ type: 'line', bindings })).toEqual(bindings)
    expect(getDrawnBindings({ type: 'bar' })).toEqual([])
    // Switching type is a pure change of `type`, so the stored list is untouched.
    expect(bindings).toHaveLength(2)
  })

  it('moves a binding to the front for the heatmap source', () => {
    const bindings = [
      { sectionId: 'running', metric: 'value' },
      { sectionId: 'diary', metric: 'wordcount' },
      { sectionId: 'mood', metric: 'value' }
    ]
    expect(moveBindingToFront(bindings, 'mood').map(binding => binding.sectionId)).toEqual([
      'mood', 'running', 'diary'
    ])
    expect(moveBindingToFront(bindings, 'ghost')).toBe(bindings)
  })
})

describe('getHeatmapDays', () => {
  // Wednesday 2026-05-20.
  const today = new Date(2026, 4, 20)

  it('covers the last N days and starts on a Monday', () => {
    const days = getHeatmapDays({ dateRange: '7' }, [], today)
    expect(days[0]).toBe('2026-05-11')
    expect(days[days.length - 1]).toBe('2026-05-20')
    expect(new Date(days[0]).getUTCDay()).toBe(1)
  })

  it('runs all-time views from the first recorded day, keeping empty days', () => {
    const days = getHeatmapDays({ dateRange: 'all' }, ['2026-05-06', '2026-05-18'], today)
    // 2026-05-06 is a Wednesday, so the grid starts on Monday 05-04.
    expect(days[0]).toBe('2026-05-04')
    expect(days).toContain('2026-05-12')
    expect(days[days.length - 1]).toBe('2026-05-20')
    expect(days).toHaveLength(17)
  })

  it('falls back to a year when nothing is recorded or the dates are unusable', () => {
    expect(getHeatmapDays({ dateRange: 'all' }, [], today).length).toBeGreaterThanOrEqual(365)
    expect(getHeatmapDays({ dateRange: 'all' }, ['not-a-date'], today).length).toBeGreaterThanOrEqual(365)
    expect(getHeatmapDays({ dateRange: 'all' }, ['2099-01-01'], today).length).toBeGreaterThanOrEqual(365)
  })
})
