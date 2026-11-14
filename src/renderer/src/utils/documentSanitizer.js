import { getSchema } from '@tiptap/core'
import { buildContentExtensions } from '../components/TiptapEditor/contentExtensions'
import { parseStoredDocument, plainTextDocument, richTextToPlainText } from './richText'

/**
 * A stored document the editor's schema cannot hold (a node or mark this version does not know,
 * from a newer build, a hand-edited or imported file) would otherwise be dropped by the editor: it
 * shows an empty card, and the first keystroke saves that emptiness over the real content.
 *
 * `prepareDocument` turns any stored value into a document the editor can open without losing
 * its text: unknown marks are removed, unknown nodes are replaced by what they contain, and as a
 * last resort the text alone is kept, one paragraph per line.
 */

export const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] }

let contentSchema = null
function defaultSchema() {
  if (!contentSchema) contentSchema = getSchema(buildContentExtensions())
  return contentSchema
}

function isValid(schema, doc) {
  try {
    schema.nodeFromJSON(doc).check()
    return true
  } catch {
    return false
  }
}

// Returns an array of nodes: an unknown node turns into its (cleaned) children.
function cleanNode(schema, node) {
  if (!node || typeof node !== 'object') return []
  if (node.type === 'text') {
    if (typeof node.text !== 'string' || node.text === '') return []
    const marks = Array.isArray(node.marks) ? node.marks.filter(mark => mark && schema.marks[mark.type]) : []
    const cleaned = { type: 'text', text: node.text }
    if (marks.length > 0) cleaned.marks = marks
    return [cleaned]
  }
  const children = Array.isArray(node.content) ? node.content.flatMap(child => cleanNode(schema, child)) : []
  if (!schema.nodes[node.type]) return children
  const cleaned = { ...node }
  if (Array.isArray(node.content)) cleaned.content = children
  if (Array.isArray(node.marks)) cleaned.marks = node.marks.filter(mark => mark && schema.marks[mark.type])
  return [cleaned]
}

/** { doc, repaired }: a document the schema accepts, and whether anything had to be changed. */
export function prepareDocument(value, schema = defaultSchema()) {
  if (value === undefined || value === null || value === '') return { doc: EMPTY_DOCUMENT, repaired: false }
  const document = parseStoredDocument(value)
  if (!document) {
    // Legacy plain text, or a value that is valid JSON but not a document ("2024", "[1,2]").
    return { doc: plainTextDocument(typeof value === 'string' ? value : ''), repaired: false }
  }
  if (isValid(schema, document)) return { doc: document, repaired: false }

  try {
    const [cleaned] = cleanNode(schema, document)
    if (cleaned && isValid(schema, cleaned)) return { doc: cleaned, repaired: true }
  } catch {
    // Nested so deeply that cleaning ran out of stack: the text alone is kept below.
  }
  return { doc: plainTextDocument(richTextToPlainText(document)), repaired: true }
}
