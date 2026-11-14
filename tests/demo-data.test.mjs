import { describe, expect, it } from 'vitest'
import { DEMO_NUMBER_RANGES, DEMO_SECTIONS, buildDemoData } from '../scripts/lib/demo-data.mjs'
import { prepareDocument } from '../src/renderer/src/utils/documentSanitizer.js'
import { extractPlainText } from '../src/renderer/src/utils/richText.js'

const today = new Date(2026, 10, 14)
const data = buildDemoData({ days: 210, today })
const numberIds = Object.keys(DEMO_NUMBER_RANGES)
const valuesOf = id => data.days.map(day => day.entries[id]).filter(Boolean).map(entry => Number(entry.value))

describe('the demo sample history', () => {
  it('is the same every time for the same arguments', () => {
    expect(buildDemoData({ days: 210, today })).toEqual(data)
    expect(buildDemoData({ days: 210, today, seed: 7 })).not.toEqual(data)
  })

  it('covers months of days, each a real calendar day, none in the future, and leaves today empty', () => {
    expect(data.days.length).toBeGreaterThan(170)
    const isos = data.days.map(day => day.iso)
    expect(new Set(isos).size).toBe(isos.length)
    for (const day of data.days) {
      expect(`${day.year}-${day.month}-${day.day}`).toBe(day.iso)
      expect(Number.isNaN(new Date(day.iso).getTime())).toBe(false)
      expect(day.iso < '2026-11-14').toBe(true)
    }
    expect(buildDemoData({ days: 30, today, withToday: true }).days.some(day => day.iso === '2026-11-14')).toBe(true)
  })

  it('has the text and number sections it promises, with unique ids', () => {
    const ids = data.sections.map(section => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(data.sections).toEqual(DEMO_SECTIONS)
    expect(data.sections.filter(section => section.type === 'text').map(section => section.name))
      .toEqual(['日记', 'Tessera 软件开发', '英语学习', '投资记录'])
    expect(data.sections.filter(section => section.type === 'number').map(section => section.unit))
      .toEqual(['h', 'min', '元', 'kg', '分'])
    expect(data.sections.filter(section => section.resident).map(section => section.id)).toEqual(['diary'])
  })

  it.each(numberIds)('keeps %s inside its range and free of outliers', id => {
    const { min, max, decimals } = DEMO_NUMBER_RANGES[id]
    const values = valuesOf(id).sort((a, b) => a - b)
    expect(values.length).toBeGreaterThan(80)
    expect(values[0]).toBeGreaterThanOrEqual(min)
    expect(values[values.length - 1]).toBeLessThanOrEqual(max)
    for (const value of values) expect(Number(value.toFixed(decimals))).toBe(value)
    // Natural ups and downs, but nothing like a value ten times the usual one.
    const median = values[Math.floor(values.length / 2)]
    expect(values[values.length - 1] / median).toBeLessThan(5)
    expect(new Set(values).size).toBeGreaterThan(3)
  })

  it('writes every number as plain numeric text and every text section as a document the editor accepts', () => {
    for (const day of data.days) {
      for (const [id, entry] of Object.entries(day.entries)) {
        expect(typeof entry.value).toBe('string')
        expect(Number.isNaN(new Date(entry.updatedAt).getTime())).toBe(false)
        if (numberIds.includes(id)) {
          expect(entry.value).toMatch(/^\d+(\.\d+)?$/)
        } else {
          expect(DEMO_SECTIONS.some(section => section.id === id && section.type === 'text')).toBe(true)
          const { doc, repaired } = prepareDocument(entry.value)
          expect(repaired).toBe(false)
          expect(extractPlainText(entry.value).trim().length).toBeGreaterThan(5)
          expect(doc.type).toBe('doc')
        }
      }
    }
  })

  it('records sleep and mood together, so a chart of both never has a hole', () => {
    for (const day of data.days) {
      expect('sleep' in day.entries).toBe('mood' in day.entries)
    }
  })

  it('points its charts, notes and favourites at things that exist', () => {
    const sectionIds = new Set(data.sections.map(section => section.id))
    for (const card of data.metadata.analytics) {
      expect(card.bindings.length).toBeGreaterThan(0)
      for (const binding of card.bindings) expect(sectionIds.has(binding.sectionId)).toBe(true)
    }
    expect(new Set(data.metadata.analytics.map(card => card.id)).size).toBe(data.metadata.analytics.length)
    for (const countdown of data.metadata.countdowns) expect(countdown.date > '2026-11-14').toBe(true)
    const dates = new Set(data.days.map(day => day.iso))
    for (const favorite of data.metadata.favorites) {
      expect(dates.has(favorite.date)).toBe(true)
      expect(sectionIds.has(favorite.sectionId)).toBe(true)
    }
    expect(data.notes.length).toBeGreaterThan(3)
    expect(new Set(data.notes.map(note => note.id)).size).toBe(data.notes.length)
  })

  it('mentions no real-looking contact details', () => {
    const everything = JSON.stringify(data)
    expect(everything).not.toMatch(/@[\w-]+\.\w+/)
    expect(everything).not.toMatch(/https?:\/\//)
    expect(everything).not.toMatch(/\d{11}/)
  })
})
