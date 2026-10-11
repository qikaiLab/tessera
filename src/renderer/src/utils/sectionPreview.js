function collectBlocks(node, blocks) {
  if (!node || typeof node !== 'object') return
  if (node.type === 'text') return
  const isTextBlock = node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock'
  if (isTextBlock) {
    const text = (node.content || []).map(child => child.text ?? '').join('').trim()
    if (text) blocks.push(text)
    return
  }
  for (const child of node.content || []) collectBlocks(child, blocks)
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
