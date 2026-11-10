import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { buildContentExtensions } from '../src/renderer/src/components/TiptapEditor/contentExtensions.js'
import { plainTextToParagraphs } from '../src/renderer/src/components/TiptapEditor/editorHelpers.js'
import { prepareDocument } from '../src/renderer/src/utils/documentSanitizer.js'
import { parseRichText, parseStoredDocument, plainTextDocument, richTextToPlainText } from '../src/renderer/src/utils/richText.js'

const schema = getSchema(buildContentExtensions())
const paragraph = (text, marks) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] })
const doc = (...content) => ({ type: 'doc', content })
const accepts = value => { schema.nodeFromJSON(value).check() }

describe('opening stored documents', () => {
  it('leaves a valid document exactly as it is', () => {
    const valid = doc(paragraph('正常内容', [{ type: 'bold' }]))
    const result = prepareDocument(valid)
    expect(result.repaired).toBe(false)
    expect(result.doc).toBe(valid)
  })

  it('gives empty values an empty paragraph to type into', () => {
    for (const empty of [null, undefined, '']) {
      expect(prepareDocument(empty)).toEqual({ doc: { type: 'doc', content: [{ type: 'paragraph' }] }, repaired: false })
    }
  })

  it('keeps the text of a node this version does not know instead of showing an empty card', () => {
    const stored = doc(
      { type: 'callout', content: [paragraph('来自新版本的提示框')] },
      paragraph('后面的段落')
    )
    const result = prepareDocument(stored)
    expect(result.repaired).toBe(true)
    expect(() => accepts(result.doc)).not.toThrow()
    expect(richTextToPlainText(result.doc)).toBe('来自新版本的提示框\n后面的段落')
  })

  it('drops an unknown mark but keeps the text and the marks it does know', () => {
    const stored = doc(paragraph('带标记', [{ type: 'sparkle' }, { type: 'bold' }]))
    const result = prepareDocument(stored)
    expect(result.repaired).toBe(true)
    expect(result.doc.content[0].content[0].marks).toEqual([{ type: 'bold' }])
    expect(result.doc.content[0].content[0].text).toBe('带标记')
  })

  it('falls back to the text alone when cleaning cannot make a valid document', () => {
    // A list item that only held unknown nodes ends up with nothing inside it.
    const stored = doc(
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'mystery', content: [] }] }] },
      paragraph('其他文字')
    )
    const result = prepareDocument(stored)
    expect(result.repaired).toBe(true)
    expect(() => accepts(result.doc)).not.toThrow()
    expect(richTextToPlainText(result.doc)).toContain('其他文字')
  })

  it('shows legacy plain text, including text that is valid JSON, as text', () => {
    for (const legacy of ['2024', '123', 'true', 'null', '[1,2]']) {
      const result = prepareDocument(legacy)
      expect(result.repaired).toBe(false)
      expect(result.doc.content[0].content[0].text).toBe(legacy)
    }
  })

  it('splits legacy plain text into one paragraph per line', () => {
    const result = prepareDocument('第一行\r\n第二行\n\n第四行')
    expect(result.doc.content.map(node => node.content?.[0]?.text ?? '')).toEqual(['第一行', '第二行', '', '第四行'])
  })

  it('opens a serialized document as well as an object', () => {
    const stored = doc(paragraph('已序列化'))
    expect(prepareDocument(JSON.stringify(stored)).doc).toEqual(stored)
  })
})

describe('stored value parsing', () => {
  it('accepts only documents as documents', () => {
    const stored = doc(paragraph('内容'))
    expect(parseStoredDocument(stored)).toBe(stored)
    expect(parseStoredDocument(JSON.stringify(stored))).toEqual(stored)
    for (const notADocument of ['2024', 'true', 'null', '[1,2]', '纯文字', 8000, [1, 2], { type: 'paragraph' }, null, undefined]) {
      expect(parseStoredDocument(notADocument)).toBeNull()
    }
  })

  it('never treats a JSON array as a document tree', () => {
    expect(richTextToPlainText('[1,2]')).toBe('[1,2]')
    expect(parseRichText([1, 2])).toEqual(plainTextDocument('1,2'))
  })
})

describe('pasted text', () => {
  const texts = paragraphs => paragraphs.map(node => node.content?.[0]?.text ?? '')

  it('becomes one paragraph per line, whatever the line endings', () => {
    expect(texts(plainTextToParagraphs('a\r\nb\nc\rd'))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('never leaves a line break inside a text node', () => {
    for (const node of plainTextToParagraphs('一\r\n二\n三')) {
      expect(node.content?.[0]?.text ?? '').not.toMatch(/[\r\n]/)
    }
  })

  it('does not add an empty paragraph for a trailing line break', () => {
    expect(texts(plainTextToParagraphs('整行\r\n'))).toEqual(['整行'])
    expect(texts(plainTextToParagraphs('上\n\n下'))).toEqual(['上', '', '下'])
  })
})

describe('editor extensions', () => {
  it('registers each extension once (the StarterKit link and underline are replaced, not doubled)', () => {
    const names = []
    const collect = (extension) => {
      names.push(extension.name)
      const children = extension.config.addExtensions?.call({ name: extension.name, options: extension.options, parent: null }) ?? []
      children.forEach(collect)
    }
    buildContentExtensions().forEach(collect)
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
    expect(duplicates).toEqual([])
    expect(names).toContain('link')
    expect(names).toContain('underline')
  })

  it('keeps links from opening on click through the extension itself', () => {
    const link = buildContentExtensions().find(extension => extension.name === 'link')
    expect(link.options.openOnClick).toBe(false)
  })
})
