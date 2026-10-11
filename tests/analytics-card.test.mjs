import { describe, expect, it } from 'vitest'
import {
  getDrawnBindings,
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
