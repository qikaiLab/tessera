import React from 'react'

const INLINE = /(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|\{\{.+?\}\})/g

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Wraps the parts of `text` that match a search word in <mark>.
function highlight(text, words) {
  if (!words.length) return text
  const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(pattern).map((part, index) => (
    index % 2 === 1 ? <mark key={index}>{part}</mark> : part
  ))
}

/** Inline text: `**bold**`, `[[Key]]` caps, `{{typed text}}` code and search highlighting. */
export function GuideInline({ text, words = [] }) {
  return text.split(INLINE).map((piece, index) => {
    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
      return <strong key={index}>{highlight(piece.slice(2, -2), words)}</strong>
    }
    if (piece.startsWith('{{') && piece.endsWith('}}')) {
      return <code key={index} className="guide-code">{highlight(piece.slice(2, -2), words)}</code>
    }
    if (piece.startsWith('[[') && piece.endsWith(']]')) {
      return <kbd key={index} className="guide-kbd">{piece.slice(2, -2)}</kbd>
    }
    return <React.Fragment key={index}>{highlight(piece, words)}</React.Fragment>
  })
}

// One block of a topic (see guideTopics.js for the shapes).
export default function GuideBlock({ block, words, actions }) {
  const inline = text => <GuideInline text={text} words={words} />

  switch (block.t) {
    case 'h':
      return <h4 className="guide-heading">{inline(block.text)}</h4>
    case 'p':
      return <p className="guide-text">{inline(block.text)}</p>
    case 'list':
      return (
        <ul className="guide-list">
          {block.items.map((item, index) => <li key={index}>{inline(item)}</li>)}
        </ul>
      )
    case 'steps':
      return (
        <ol className="guide-steps">
          {block.items.map((item, index) => <li key={index}>{inline(item)}</li>)}
        </ol>
      )
    case 'table':
      return (
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>{block.head.map((cell, index) => <th key={index}>{inline(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => <td key={index}>{inline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'tip':
    case 'warn':
      return (
        <div className={`guide-callout is-${block.t}`} role="note">
          <span className="guide-callout-mark" aria-hidden="true">{block.t === 'tip' ? '💡' : '⚠'}</span>
          <p>{inline(block.text)}</p>
        </div>
      )
    case 'action':
      return (
        <button type="button" className="guide-action" onClick={actions?.[block.id]}>
          {block.label}
        </button>
      )
    default:
      return null
  }
}
