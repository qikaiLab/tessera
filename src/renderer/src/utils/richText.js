import { isLocalFileHref } from './localFileLinks'

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

// The text of a stored value (a Tiptap document, its serialized JSON, or legacy plain text) with
// nothing between blocks: for searching, word counts and one-line snippets. See
// richTextToPlainText for the version that keeps line breaks.
export function extractPlainText(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      // Only a document counts: text like "8000" or "true" is valid JSON but plain text.
      if (parsed && typeof parsed === 'object') return nodeText(parsed)
    } catch {
      // Legacy plain text falls through.
    }
    return value
  }
  if (typeof value === 'object') return nodeText(value)
  return String(value)
}

function nodeText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  if (Array.isArray(node.content)) {
    const text = node.content.map(nodeText).join('')
    // Keep neighbouring table cells from running together in searches and snippets.
    return node.type === 'tableCell' || node.type === 'tableHeader' ? `${text} ` : text
  }
  return ''
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'codeBlock', 'listItem', 'taskItem', 'tableRow'])

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

// Web, mail and phone addresses, and links to a file or folder on this computer.
export function isSafeLink(href) {
  return typeof href === 'string' && (SAFE_LINK.test(href.trim()) || isLocalFileHref(href))
}
