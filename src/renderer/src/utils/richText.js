import { isLocalFileHref } from './localFileLinks'

const isNode = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

// Plain text as a document: one paragraph per line.
export function plainTextDocument(text) {
  return {
    type: 'doc',
    content: String(text ?? '').split(/\r?\n/).map(line => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : []
    }))
  }
}

// A stored value as a document (a Tiptap document or its serialized JSON), or null when it is
// not one: legacy plain text, and text that merely is valid JSON ("2024", "true", "[1,2]").
export function parseStoredDocument(value) {
  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return null
    }
  }
  return isNode(candidate) && candidate.type === 'doc' ? candidate : null
}

// Parses a stored record value (Tiptap JSON object, its serialized form, or legacy plain
// text) into a document tree. Never throws; unreadable values become an empty document.
export function parseRichText(value) {
  if (value === undefined || value === null || value === '') return { type: 'doc', content: [] }
  if (isNode(value)) return value
  const text = String(value)
  try {
    const parsed = JSON.parse(text)
    if (isNode(parsed)) return parsed
  } catch {
    // Legacy plain text falls through.
  }
  return plainTextDocument(text)
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

// The text of a text node. A hand-edited or damaged file can put anything in `text`; only a string
// (or a plain number or boolean, which read as their usual text) counts, and an object whose
// conversion to text would itself throw is read as nothing.
export function textOf(node) {
  const text = node?.text
  if (typeof text === 'string') return text
  return typeof text === 'number' || typeof text === 'boolean' ? String(text) : ''
}

// Visits a document tree depth-first without recursion: a damaged or hostile file can nest nodes
// thousands of levels deep, and a recursive walk would overflow the stack (one such day would then
// break every page that reads text, the timeline included). `enter` runs before a node's children
// and `exit` after them.
function walkNodes(root, { enter, exit }) {
  if (!root || typeof root !== 'object') return
  const stack = [{ node: root, index: 0 }]
  enter(root)
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    const children = Array.isArray(frame.node.content) ? frame.node.content : []
    if (frame.index < children.length) {
      const child = children[frame.index]
      frame.index += 1
      if (child && typeof child === 'object') {
        enter(child)
        stack.push({ node: child, index: 0 })
      }
    } else {
      exit(frame.node)
      stack.pop()
    }
  }
}

function nodeText(root) {
  const parts = []
  walkNodes(root, {
    enter: (node) => { if (node.type === 'text') parts.push(textOf(node)) },
    // Keep neighbouring table cells from running together in searches and snippets.
    exit: (node) => { if (node.type === 'tableCell' || node.type === 'tableHeader') parts.push(' ') }
  })
  return parts.join('')
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'codeBlock', 'listItem', 'taskItem', 'tableRow'])

export function richTextToPlainText(value) {
  const parts = []
  walkNodes(parseRichText(value), {
    enter: (node) => { if (node.type === 'text') parts.push(textOf(node)) },
    exit: (node) => { if (BLOCK_TYPES.has(node.type)) parts.push('\n') }
  })
  return parts.join('').replace(/\n{2,}/g, '\n').trim()
}

const SAFE_LINK = /^(https?:|mailto:|tel:)/i

// Web, mail and phone addresses, and links to a file or folder on this computer.
export function isSafeLink(href) {
  return typeof href === 'string' && (SAFE_LINK.test(href.trim()) || isLocalFileHref(href))
}
