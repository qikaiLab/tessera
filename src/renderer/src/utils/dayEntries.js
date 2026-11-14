// A stored value as text, or '' when it cannot be read as text: a damaged or hand-edited file can
// hold an object whose conversion to text throws, and a throw while drawing a page is a blank page.
export function storedText(value) {
  try {
    return String(value ?? '')
  } catch {
    return ''
  }
}

// Whether a stored value counts as "nothing written": missing, blank, or a rich-text document
// without a single visible character. Such entries are never persisted (see writeDayData) and
// must not keep an optional section "activated" on a day. A value that cannot be read as text is
// still something that is there, so it is kept rather than silently dropped.
export function isEntryEmpty(value) {
  if (value === undefined || value === null) return true
  let text
  try {
    text = String(value).trim()
  } catch {
    return false
  }
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

// A day's entries without the ones that hold nothing. Empty entries are neither shown nor
// stored, so a day whose entries are all empty has no file at all.
export function dropEmptyEntries(entries) {
  const kept = {}
  for (const [key, entry] of Object.entries(entries)) {
    if (entry?.value !== undefined && entry?.value !== null && !isEntryEmpty(entry.value)) kept[key] = entry
  }
  return kept
}

// Something is stored for the section (a number, or any non-blank text or document).
export function hasStoredValue(entry) {
  if (entry?.value === undefined || entry?.value === null) return false
  try {
    return String(entry.value).trim() !== ''
  } catch {
    return true
  }
}

// Resident sections are always on a day. An optional ("activated") one is there while it holds
// something, or because the user just added it by hand, or while it folds away after closing.
export function isSectionOnDay(section, entry, { added = false, leaving = false } = {}) {
  if (section.resident) return true
  return added || leaving || hasStoredValue(entry)
}

// Optional sections that can still be offered under "add record".
export function isSectionAddable(section, entry, added = false) {
  return !section.resident && !added && !hasStoredValue(entry)
}
