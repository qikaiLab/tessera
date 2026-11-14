import { describe, expect, it } from 'vitest'
import { extractPlainText, richTextToPlainText } from '../src/renderer/src/utils/richText.js'
import { getSectionPreview } from '../src/renderer/src/utils/sectionPreview.js'

const doc = (...texts) => ({
  type: 'doc',
  content: texts.map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
})

describe('extractPlainText', () => {
  it('joins the text of a document with nothing between blocks', () => {
    expect(extractPlainText(doc('你好', '世界'))).toBe('你好世界')
    expect(extractPlainText(JSON.stringify(doc('abc', 'def')))).toBe('abcdef')
  })

  it('returns legacy plain text as it is, including text that happens to be valid JSON', () => {
    expect(extractPlainText('just words')).toBe('just words')
    expect(extractPlainText('8000')).toBe('8000')
    expect(extractPlainText('true')).toBe('true')
    expect(extractPlainText('"quoted"')).toBe('"quoted"')
  })

  it('reads nothing from empty values and documents without text', () => {
    for (const value of [null, undefined, '', 0]) expect(extractPlainText(value)).toBe('')
    expect(extractPlainText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('')
    expect(extractPlainText('{"type":"doc","content":[]}')).toBe('')
  })

  it('reads nested content such as lists', () => {
    const list = {
      type: 'doc',
      content: [{ type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '一' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '二' }] }] }
      ] }]
    }
    expect(extractPlainText(list)).toBe('一二')
  })
})

describe('text nodes whose text is not a string', () => {
  const damaged = doc => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok ' }, doc] }] })

  it.each([
    ['an object that cannot be turned into text', { type: 'text', text: { toString: null } }],
    ['an array', { type: 'text', text: ['a', 'b'] }],
    ['null', { type: 'text', text: null }],
    ['a nested object', { type: 'text', text: { a: { b: 1 } } }]
  ])('reading %s keeps the rest of the text and does not throw', (_, node) => {
    const value = damaged(node)
    expect(extractPlainText(value)).toBe('ok ')
    expect(richTextToPlainText(value)).toBe('ok')
    expect(getSectionPreview(value)).toBe('ok')
  })

  it('still reads numbers and booleans as their text', () => {
    expect(extractPlainText(damaged({ type: 'text', text: 12 }))).toBe('ok 12')
    expect(extractPlainText(damaged({ type: 'text', text: true }))).toBe('ok true')
  })
})
