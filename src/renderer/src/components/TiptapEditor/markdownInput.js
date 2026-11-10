import { Extension, InputRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { createMarkdownParser, docHasNode, shouldPasteAsMarkdown } from './markdownPaste'
import { normalizeLinkHref } from './editorHelpers'

// Typing `[text](address)` turns it into a link, like the other Markdown shortcuts. The address
// may be a web address or a path on this computer; a path with spaces goes in <angle brackets>.
// A leading "!" means an image, which the editor does not have, so that is left as typed.
const LINK_SHORTCUT = /\[([^[\]\n]+)\]\((<[^<>\n]+>|[^()\s]+)\)$/

export const MarkdownLinkShortcut = Extension.create({
  name: 'markdownLinkShortcut',
  addInputRules() {
    return [
      new InputRule({
        find: LINK_SHORTCUT,
        handler: ({ state, range, match }) => {
          const linkType = state.schema.marks.link
          if (!linkType) return null
          const [, label, address] = match
          const href = normalizeLinkHref(address.replace(/^<|>$/g, ''))
          if (!href) return null
          if (range.from > 0 && state.doc.textBetween(range.from - 1, range.from) === '!') return null

          const marks = state.doc.resolve(range.from).marks().filter(mark => mark.type !== linkType)
          state.tr.replaceWith(range.from, range.to, state.schema.text(label, [...marks, linkType.create({ href })]))
          // What is typed next is ordinary text again.
          state.tr.removeStoredMark(linkType)
          return undefined
        }
      })
    ]
  }
})

function isInsideTable($pos) {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'table') return true
  }
  return false
}

// Pasting Markdown source renders it. Ctrl+Shift+V (paste as plain text) and anything inside a
// code block are left alone, and a paste that cannot be rendered falls back to the default.
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  addProseMirrorPlugins() {
    const editor = this.editor
    let parse = null

    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (view, event) => {
            const clipboard = event.clipboardData
            if (!clipboard || view.input?.shiftKey) return false
            const { $from } = view.state.selection
            if ($from.parent.type.spec.code) return false

            const text = clipboard.getData('text/plain')
            if (!shouldPasteAsMarkdown({ text, html: clipboard.getData('text/html') })) return false

            try {
              parse ||= createMarkdownParser(editor.extensionManager.extensions)
              const doc = parse(text)
              if (!doc.content?.length) return false
              // A table cannot hold another table.
              if (isInsideTable($from) && docHasNode(doc, 'table')) return false

              if (!editor.commands.insertContent(doc.content)) return false
              event.preventDefault()
              return true
            } catch {
              return false
            }
          }
        }
      })
    ]
  }
})
