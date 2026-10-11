// Parses a stored record value (Tiptap JSON object, its serialized form, or legacy plain
// text) into a document tree. Never throws; unreadable values become an empty document.
export function parseRichText(value) {
  if (value === undefined || value === null || value === '') return { type: 'doc', content: [] }
  if (typeof value === 'object') return value
  const text = String(value)
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // Legacy plain text falls through.
  }
  return {
    type: 'doc',
    content: text.split(/\r?\n/).map(line => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : []
    }))
  }
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'codeBlock', 'listItem', 'taskItem'])

export function richTextToPlainText(value) {
  const parts = []
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'text') {
      parts.push(node.text || '')
      return
    }
    for (const child of node.content || []) visit(child)
    if (BLOCK_TYPES.has(node.type)) parts.push('\n')
  }
  visit(parseRichText(value))
  return parts.join('').replace(/\n{2,}/g, '\n').trim()
}

const SAFE_LINK = /^(https?:|mailto:|tel:)/i

export function isSafeLink(href) {
  return typeof href === 'string' && SAFE_LINK.test(href.trim())
}
