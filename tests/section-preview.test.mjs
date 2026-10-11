import { describe, expect, it } from 'vitest'
import { getSectionPreview } from '../src/renderer/src/utils/sectionPreview.js'

const doc = (...paragraphs) => ({
  type: 'doc',
  content: paragraphs.map(text => ({
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : []
  }))
})

describe('getSectionPreview', () => {
  it('joins the non-empty blocks of a Tiptap document', () => {
    expect(getSectionPreview(doc('今天', '', '去跑步'))).toBe('今天 去跑步')
  })

  it('accepts a serialized document and legacy plain text', () => {
    expect(getSectionPreview(JSON.stringify(doc('序列化')))).toBe('序列化')
    expect(getSectionPreview('旧版纯文本')).toBe('旧版纯文本')
  })

  it('reads text inside lists and task lists', () => {
    const list = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '甲' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '乙' }] }] }
        ]
      }]
    }
    expect(getSectionPreview(list)).toBe('甲 乙')
  })

  it('truncates long text and tolerates empty values', () => {
    expect(getSectionPreview(doc('字'.repeat(200)), 10)).toBe(`${'字'.repeat(10)}…`)
    expect(getSectionPreview(null)).toBe('')
    expect(getSectionPreview(doc(''))).toBe('')
  })
})
