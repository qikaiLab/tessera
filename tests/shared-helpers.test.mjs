import { describe, expect, it } from 'vitest'
import { generateId, generateUuid } from '../src/renderer/src/utils/ids.js'
import { clamp } from '../src/renderer/src/utils/math.js'

describe('clamp', () => {
  it('keeps a value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('lets the upper bound win when the range is inverted, as the inline expressions did', () => {
    expect(clamp(5, 8, 3)).toBe(3)
  })
})

describe('generated ids', () => {
  it('makes distinct, non-empty ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+$/)
  })

  it('makes UUIDs where the platform has them', () => {
    expect(generateUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(generateUuid()).not.toBe(generateUuid())
  })
})
