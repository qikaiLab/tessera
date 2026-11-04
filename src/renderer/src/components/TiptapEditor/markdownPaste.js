import { MarkdownManager } from '@tiptap/markdown'
import { normalizeExternalUrl } from './editorHelpers'

// Pasted text above this size is left to the default paste: parsing it would stall the editor.
const MAX_MARKDOWN_LENGTH = 200_000

const FENCE = /^ {0,3}(```|~~~)/m
const HEADING = /^ {0,3}#{1,6}[ \t]+\S/m
const LIST_ITEM = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\S/
const QUOTE = /^ {0,3}>[ \t]?\S/
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/
const INLINE_SIGNALS = [
  /\*\*[^*\s](?:[^*\n]*[^*\s])?\*\*/, // **bold**
  /~~[^~\s](?:[^~\n]*[^~\s])?~~/, // ~~strike~~
  /`[^`\n]+`/, // `code`
  /!?\[[^\]\n]*\]\([^)\s]+\)/ // [text](url) and ![alt](url)
]

// Formatting tags that mean the clipboard holds real rich text (a web page, Word, this
// editor) rather than text that merely arrived wrapped in styled spans, as from a code editor.
const RICH_HTML = /<(?:h[1-6]|ul|ol|li|table|blockquote|strong|b|em|i|u|s|del|a|img)[\s>/]/i

const normalizeNewlines = text => String(text ?? '').replace(/\r\n?/g, '\n')

function hasMarkdownTable(lines) {
  return lines.some((line, index) => (
    index > 0 && TABLE_SEPARATOR.test(line) && lines[index - 1].includes('|')
  ))
}

/** Whether plain text contains enough Markdown syntax to be worth rendering. */
export function looksLikeMarkdown(text) {
  const source = normalizeNewlines(text)
  if (!source.trim() || source.length > MAX_MARKDOWN_LENGTH) return false
  if (FENCE.test(source) || HEADING.test(source)) return true

  const lines = source.split('\n')
  if (hasMarkdownTable(lines)) return true
  // A single "- x" or "> x" line is as likely to be prose as Markdown; two or more are not.
  const blockLines = lines.filter(line => LIST_ITEM.test(line) || QUOTE.test(line)).length
  if (blockLines >= 2) return true
  return INLINE_SIGNALS.some(signal => signal.test(source))
}

/**
 * Whether a paste should be rendered as Markdown: the clipboard text looks like Markdown and
 * there is no real rich text beside it (rich text, and anything copied inside this editor,
 * keeps its own formatting).
 */
export function shouldPasteAsMarkdown({ text, html }) {
  if (html && (html.includes('data-pm-slice') || RICH_HTML.test(html))) return false
  return looksLikeMarkdown(text)
}

// Images cannot be stored, so keep their address as a link instead of silently dropping it.
// Fenced code is left alone.
export function imagesToLinks(markdown) {
  let inFence = false
  return markdown.split('\n').map(line => {
    if (/^ {0,3}(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) return line
    return line.replace(
      /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
      (_, alt, url) => `[${alt.trim() || '图片'}](${url})`
    )
  }).join('\n')
}

// Drops what the editor cannot show safely: links to anything but web, mail and phone
// addresses (a pasted `javascript:` link), and text nodes with no text.
function cleanNode(node) {
  if (!node || typeof node !== 'object') return node
  const cleaned = { ...node }
  if (Array.isArray(node.marks)) {
    const marks = []
    for (const mark of node.marks) {
      if (mark.type !== 'link') {
        marks.push(mark)
        continue
      }
      const href = normalizeExternalUrl(mark.attrs?.href)
      if (href) marks.push({ ...mark, attrs: { ...mark.attrs, href } })
    }
    if (marks.length) cleaned.marks = marks
    else delete cleaned.marks
  }
  if (Array.isArray(node.content)) {
    cleaned.content = node.content
      .filter(child => !(child?.type === 'text' && !child.text))
      .map(cleanNode)
  }
  return cleaned
}

/**
 * A parser that turns Markdown into the editor's JSON document, using the schema of the given
 * extensions. It needs no DOM, so it works in unit tests too.
 */
export function createMarkdownParser(extensions) {
  const manager = new MarkdownManager({
    extensions,
    // Single line breaks stay line breaks, as in a note app rather than a Markdown file.
    markedOptions: { gfm: true, breaks: true }
  })
  return (markdown) => cleanNode(manager.parse(imagesToLinks(normalizeNewlines(markdown))))
}

/** Whether a parsed document contains a node of the given type. */
export function docHasNode(doc, typeName) {
  if (!doc || typeof doc !== 'object') return false
  if (doc.type === typeName) return true
  return (doc.content || []).some(child => docHasNode(child, typeName))
}
