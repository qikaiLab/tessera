// Whether a stored value counts as "nothing written": missing, blank, or a rich-text document
// without a single visible character. Such entries are never persisted (see writeDayData) and
// must not keep an optional section "activated" on a day.
export function isEntryEmpty(value) {
  if (value === undefined || value === null) return true
  const text = String(value).trim()
  if (text === '') return true
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const doc = JSON.parse(text)
      if (doc.type === 'doc') {
        const hasContent = (node) => {
          if (!node) return false
          if (node.type === 'text' && node.text && node.text.trim() !== '') return true
          if (node.content && Array.isArray(node.content)) return node.content.some(hasContent)
          return false
        }
        return !hasContent(doc)
      }
    } catch {
      // Not a document after all: plain text, handled below.
    }
  }
  return false
}

// An optional ("activated") section that is on screen but holds nothing can simply be closed.
export function isSectionClosable(section, entry) {
  return !section.resident && isEntryEmpty(entry?.value)
}
