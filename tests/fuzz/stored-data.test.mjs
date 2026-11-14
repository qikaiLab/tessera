import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { cloneNoteContent, parseNote, serializeNote } from '../../src/renderer/src/utils/notes.js'
import { buildContentExtensions } from '../../src/renderer/src/components/TiptapEditor/contentExtensions.js'
import { prepareDocument } from '../../src/renderer/src/utils/documentSanitizer.js'
import { extractPlainText, isSafeLink, parseRichText, parseStoredDocument, richTextToPlainText } from '../../src/renderer/src/utils/richText.js'
import { getSectionPreview } from '../../src/renderer/src/utils/sectionPreview.js'
import { dropEmptyEntries, hasStoredValue, isEntryEmpty } from '../../src/renderer/src/utils/dayEntries.js'
import { interpretSectionsFile } from '../../src/renderer/src/context/sectionsFile.js'
import { anyDocument, anyJson, anyText, fuzzParams, storedValue, validDocument } from './arbitrary.mjs'

// Data files can be damaged, hand-edited, imported from a newer version or just odd. Whatever the
// stored value is, reading it must never throw (a throw during render is a blank page), and a value
// that holds text must not lose it silently.

const schema = getSchema(buildContentExtensions())
const accepts = (doc) => {
  try {
    schema.nodeFromJSON(doc).check()
    return true
  } catch {
    return false
  }
}

describe('reading stored documents never throws', () => {
  it('parseRichText, extractPlainText, richTextToPlainText, getSectionPreview', () => {
    fc.assert(fc.property(storedValue, (value) => {
      parseRichText(value)
      expect(typeof extractPlainText(value)).toBe('string')
      expect(typeof richTextToPlainText(value)).toBe('string')
      expect(typeof getSectionPreview(value)).toBe('string')
    }), fuzzParams())
  })

  it('parseStoredDocument returns a document or null, nothing else', () => {
    fc.assert(fc.property(storedValue, (value) => {
      const doc = parseStoredDocument(value)
      expect(doc === null || doc.type === 'doc').toBe(true)
    }), fuzzParams())
  })

  it('entry helpers accept any value', () => {
    fc.assert(fc.property(storedValue, (value) => {
      expect(typeof isEntryEmpty(value)).toBe('boolean')
      hasStoredValue({ value })
      dropEmptyEntries({ a: { value }, b: { value: '' } })
    }), fuzzParams())
  })
})

describe('prepareDocument', () => {
  it('always yields a document the editor schema accepts', () => {
    fc.assert(fc.property(storedValue, (value) => {
      const { doc } = prepareDocument(value)
      expect(accepts(doc)).toBe(true)
    }), fuzzParams({ numRuns: 200 }))
  })

  it('keeps every character of the text, even when nodes or marks are unknown or malformed', () => {
    fc.assert(fc.property(anyDocument, (original) => {
      const before = richTextToPlainText(original).replace(/\s+/g, '')
      const { doc } = prepareDocument(original)
      const after = richTextToPlainText(doc).replace(/\s+/g, '')
      // Cleaning may drop whitespace and empty nodes but never characters of text.
      expect(after).toBe(before)
    }), fuzzParams({ numRuns: 200 }))
  })

  it('leaves a document that is already valid untouched', () => {
    fc.assert(fc.property(validDocument, (original) => {
      expect(accepts(original)).toBe(true)
      const { doc, repaired } = prepareDocument(original)
      expect(repaired).toBe(false)
      expect(doc).toEqual(original)
    }), fuzzParams())
  })

  it.each([1000, 5000, 20_000, 200_000])('survives a document nested %i levels deep', (depth) => {
    // Built by hand: JSON.stringify itself gives up long before a damaged file could.
    const text = `{"type":"doc","content":[${'{"type":"blockquote","content":['.repeat(depth)}{"type":"text","text":"deep"}${']}'.repeat(depth)}]}`
    expect(() => prepareDocument(text)).not.toThrow()
    expect(() => extractPlainText(text)).not.toThrow()
    expect(() => richTextToPlainText(text)).not.toThrow()
    expect(() => getSectionPreview(text)).not.toThrow()
    expect(() => parseRichText(text)).not.toThrow()
    expect(() => isEntryEmpty(text)).not.toThrow()
    expect(() => cloneNoteContent(JSON.parse(text))).not.toThrow()
  })

  it('handles a multi-megabyte document in reasonable time', () => {
    const paragraph = { type: 'paragraph', content: [{ type: 'text', text: '日记'.repeat(100) }] }
    const big = JSON.stringify({ type: 'doc', content: Array.from({ length: 12_000 }, () => paragraph) })
    expect(big.length).toBeGreaterThan(2_000_000)
    const started = performance.now()
    const { doc } = prepareDocument(big)
    expect(doc.content).toHaveLength(12_000)
    expect(richTextToPlainText(big).length).toBeGreaterThan(1_000_000)
    expect(performance.now() - started).toBeLessThan(10_000)
  })
})

describe('note files', () => {
  it('parseNote returns a note or null for any file content, and serializeNote round-trips it', () => {
    fc.assert(fc.property(fc.oneof(storedValue, anyText).map(value => (typeof value === 'string' ? value : JSON.stringify(value) ?? 'undefined')), (raw) => {
      const note = parseNote(raw, { id: 'fallback', title: '' })
      if (note === null) return
      expect(typeof note.id).toBe('string')
      expect(typeof note.pinned).toBe('boolean')
      expect(Number.isFinite(note.fontSize)).toBe(true)
      const again = parseNote(serializeNote(note), { id: 'fallback', title: '' })
      expect(again).not.toBeNull()
      expect(again.id).toBe(note.id)
      expect(again.content).toEqual(note.content)
    }), fuzzParams())
  })
})

describe('isSafeLink', () => {
  it('only ever allows web, mail, phone and local drive links', () => {
    fc.assert(fc.property(anyText, (href) => {
      if (!isSafeLink(href)) return
      expect(href.trim()).toMatch(/^(https?:|mailto:|tel:|file:\/\/\/[A-Za-z]:\/)/i)
    }), fuzzParams({ numRuns: 1000 }))
  })

  it('refuses script and data links however they are dressed up', () => {
    for (const href of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', '\tjavascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'file://server/share/x', 'file:///etc/passwd', 'file:///C:/../Windows/x', 'ftp://x', '//evil.example', 'blob:https://x']) {
      expect(isSafeLink(href), href).toBe(false)
    }
  })
})

describe('sections.json', () => {
  it('interpretSectionsFile always gives a list of sections and never throws', () => {
    const fileResult = fc.oneof(
      fc.record({ ok: fc.constant(true), data: fc.oneof(anyText, anyJson.map(value => JSON.stringify(value))) }),
      fc.record({ ok: fc.constant(false), error: fc.oneof(anyText, fc.constantFrom('ENOENT', 'EACCES: permission denied', 'EBUSY')) }),
      fc.constantFrom({ ok: false }, { ok: true, data: '' })
    )
    fc.assert(fc.property(fileResult, (result) => {
      const outcome = interpretSectionsFile(result)
      expect(Array.isArray(outcome.sections)).toBe(true)
      // A file that exists but cannot be understood is never overwritten with the defaults.
      if (result.ok) expect(outcome.writeDefaults).toBe(false)
    }), fuzzParams())
  })
})
