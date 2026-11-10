import React from 'react'
import { clamp } from '../utils/math'
import { isSafeLink, parseRichText } from '../utils/richText'
import { openLinkHref } from './TiptapEditor/editorHelpers'
import { useApp } from '../context/AppContext'

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text, highlight, keyPrefix) {
  if (!highlight) return text
  const pattern = new RegExp(`(${escapeRegex(highlight)})`, 'gi')
  const lower = highlight.toLowerCase()
  return text.split(pattern).map((part, index) => (
    part.toLowerCase() === lower
      ? <mark key={`${keyPrefix}-${index}`}>{part}</mark>
      : part
  ))
}

function applyMarks(content, marks, key) {
  let result = content
  for (const mark of marks || []) {
    if (mark.type === 'bold') result = <strong key={key}>{result}</strong>
    else if (mark.type === 'italic') result = <em key={key}>{result}</em>
    else if (mark.type === 'underline') result = <u key={key}>{result}</u>
    else if (mark.type === 'strike') result = <s key={key}>{result}</s>
    else if (mark.type === 'code') result = <code key={key}>{result}</code>
    else if (mark.type === 'link' && isSafeLink(mark.attrs?.href)) {
      const href = mark.attrs.href
      result = <a key={key} href={href}>{result}</a>
    }
  }
  return result
}

function renderChildren(node, highlight, keyPrefix) {
  return (node.content || []).map((child, index) => renderNode(child, highlight, `${keyPrefix}-${index}`))
}

function renderNode(node, highlight, key) {
  if (!node || typeof node !== 'object') return null
  const children = () => renderChildren(node, highlight, key)

  switch (node.type) {
    case 'text':
      return applyMarks(highlightText(node.text || '', highlight, key), node.marks, key)
    case 'paragraph': {
      const inner = children()
      return <p key={key}>{inner.length ? inner : <br />}</p>
    }
    case 'heading': {
      const level = clamp(Number(node.attrs?.level) || 1, 1, 3)
      return React.createElement(`h${level}`, { key }, children())
    }
    case 'bulletList':
      return <ul key={key}>{children()}</ul>
    case 'orderedList':
      return <ol key={key} start={node.attrs?.start > 1 ? node.attrs.start : undefined}>{children()}</ol>
    case 'listItem':
      return <li key={key}>{children()}</li>
    case 'taskList':
      return <ul key={key} data-type="taskList">{children()}</ul>
    case 'taskItem': {
      const checked = Boolean(node.attrs?.checked)
      return (
        <li key={key} data-checked={checked ? 'true' : 'false'}>
          <label><input type="checkbox" checked={checked} disabled readOnly /></label>
          <div>{children()}</div>
        </li>
      )
    }
    case 'blockquote':
      return <blockquote key={key}>{children()}</blockquote>
    case 'codeBlock':
      return <pre key={key}><code>{(node.content || []).map(child => child.text || '').join('')}</code></pre>
    case 'table':
      return <div key={key} className="tableWrapper"><table><tbody>{children()}</tbody></table></div>
    case 'tableRow':
      return <tr key={key}>{children()}</tr>
    case 'tableHeader':
    case 'tableCell': {
      const Cell = node.type === 'tableHeader' ? 'th' : 'td'
      const { colspan, rowspan, align } = node.attrs || {}
      return (
        <Cell
          key={key}
          colSpan={colspan > 1 ? colspan : undefined}
          rowSpan={rowspan > 1 ? rowspan : undefined}
          style={['left', 'center', 'right'].includes(align) ? { textAlign: align } : undefined}
        >
          {children()}
        </Cell>
      )
    }
    case 'hardBreak':
      return <br key={key} />
    case 'horizontalRule':
      return <hr key={key} />
    default:
      return <React.Fragment key={key}>{children()}</React.Fragment>
  }
}

/**
 * Read-only rendering of a stored record value. Reuses the editor's content styles by
 * emitting the same DOM structure Tiptap does.
 */
export default function RichTextView({ value, highlight = '', fontSize, className = '' }) {
  // Without the app context (a bare render) a failed open just goes unreported.
  const showToast = useApp()?.showToast
  const doc = parseRichText(value)

  // One handler for every link in the view, so web addresses and local paths behave as they do in the editor.
  const handleClick = (event) => {
    const link = event.target?.closest?.('a[href]')
    if (link && openLinkHref(link.getAttribute('href'), showToast)) event.preventDefault()
  }

  return (
    <div
      className={`ProseMirror rich-view ${className}`.trim()}
      style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
      onClick={handleClick}
    >
      {renderChildren(doc, highlight, 'n')}
    </div>
  )
}
