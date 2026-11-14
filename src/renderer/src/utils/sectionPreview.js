import { textOf } from './richText'

const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock'])

// The text of each paragraph, heading and code block in reading order. Walked with an explicit
// stack: a damaged file can nest nodes so deeply that recursion would run out of stack, and the
// preview of one such day must not take the whole page down. Malformed nodes (a null child, a
// content that is not a list) are skipped rather than thrown on.
function collectBlocks(root, blocks) {
  const stack = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || typeof node !== 'object' || node.type === 'text') continue
    const children = Array.isArray(node.content) ? node.content : []
    if (TEXT_BLOCKS.has(node.type)) {
      const text = children.map(child => (child && typeof child === 'object' ? textOf(child) : '')).join('').trim()
      if (text) blocks.push(text)
      continue
    }
    for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index])
  }
}

// One-line summary of a rich-text value (a Tiptap JSON document, its serialized form, or
// legacy plain text), used while a record card is collapsed.
export function getSectionPreview(value, maxLength = 80) {
  if (!value) return ''
  let doc = value
  if (typeof value === 'string') {
    try {
      doc = JSON.parse(value)
    } catch {
      doc = null
    }
    if (typeof doc !== 'object' || doc === null) doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: String(value) }] }] }
  }

  const blocks = []
  collectBlocks(doc, blocks)
  const text = blocks.join(' ').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text
}
