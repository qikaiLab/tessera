import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { buildContentExtensions } from '../src/renderer/src/components/TiptapEditor/contentExtensions.js'
import { plainTextTransaction } from '../src/renderer/src/components/TiptapEditor/editorHelpers.js'

// The right-click "paste" must behave like Ctrl+V: this runs the real schema through the real
// transaction, with the caret at a chosen offset of the first textblock.

const schema = getSchema(buildContentExtensions())
const text = value => ({ type: 'text', text: value })
const paragraph = value => ({ type: 'paragraph', content: [text(value)] })

// The caret sits `offset` characters into the first textblock (start of it + offset).
function paste(docJson, offset, clipboard, selectTo = offset) {
  const doc = schema.nodeFromJSON(docJson)
  let start = 0
  doc.descendants((node, pos) => {
    if (node.isTextblock && !start) start = pos + 1
    return !start
  })
  const state = EditorState.create({ doc, selection: TextSelection.create(doc, start + offset, start + selectTo) })
  const tr = plainTextTransaction(state, clipboard)
  return tr ? state.apply(tr).doc.toJSON() : null
}

const blocks = result => result.content.map(node => ({ type: node.type, text: (node.content ?? []).map(part => part.text).join('') }))

describe('pasting plain text from the menu', () => {
  it('puts one line into the line being edited', () => {
    const result = paste({ type: 'doc', content: [paragraph('AB')] }, 1, '一')
    expect(blocks(result)).toEqual([{ type: 'paragraph', text: 'A一B' }])
  })

  it('keeps the first and last pasted line joined to the text around the caret, like Ctrl+V', () => {
    const result = paste({ type: 'doc', content: [paragraph('AB')] }, 1, '一\r\n二\n三')
    expect(blocks(result)).toEqual([
      { type: 'paragraph', text: 'A一' },
      { type: 'paragraph', text: '二' },
      { type: 'paragraph', text: '三B' }
    ])
  })

  it('pastes several lines into an empty paragraph as one paragraph each', () => {
    const result = paste({ type: 'doc', content: [{ type: 'paragraph' }] }, 0, '第一行\r\n第二行\n第三行')
    expect(blocks(result).map(block => block.text)).toEqual(['第一行', '第二行', '第三行'])
  })

  it('replaces a selection', () => {
    const result = paste({ type: 'doc', content: [paragraph('ABCD')] }, 1, '甲\n乙', 3)
    expect(blocks(result).map(block => block.text)).toEqual(['A甲', '乙D'])
  })

  it('keeps the lines inside a code block instead of splitting the block', () => {
    const codeBlock = { type: 'codeBlock', content: [text('x')] }
    const result = paste({ type: 'doc', content: [codeBlock] }, 1, 'line1\r\nline2\nline3')
    expect(blocks(result)).toEqual([{ type: 'codeBlock', text: 'xline1\nline2\nline3' }])
  })

  it('splits a heading at the caret without turning the pasted lines into headings', () => {
    const heading = { type: 'heading', attrs: { level: 2 }, content: [text('标题')] }
    const result = paste({ type: 'doc', content: [heading] }, 1, '甲\n乙')
    expect(blocks(result)[0]).toEqual({ type: 'heading', text: '标甲' })
    expect(blocks(result).at(-1).text).toBe('乙题')
  })

  it('pastes nothing for an empty clipboard, so a selection is not deleted', () => {
    expect(paste({ type: 'doc', content: [paragraph('ABCD')] }, 1, '', 3)).toBeNull()
    expect(paste({ type: 'doc', content: [paragraph('ABCD')] }, 1, '\r\n', 3)).toBeNull()
  })
})
