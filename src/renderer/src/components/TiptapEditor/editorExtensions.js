import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { SlashExtension } from './slashExtension'
import { buildContentExtensions } from './contentExtensions'
import { MarkdownLinkShortcut, MarkdownPaste } from './markdownInput'
import { TableColumnWidths } from './tableColumnWidths'

/** Remove the character formatting at the cursor / selection and refocus the editor view. */
export function clearCharacterFormattingFromView(view) {
  if (!view) return false

  const { state } = view
  const { selection, schema } = state
  let tr = state.tr

  if (!selection.empty) {
    Object.values(schema.marks).forEach(markType => {
      tr = tr.removeMark(selection.from, selection.to, markType)
    })
  }

  tr = tr.setStoredMarks([])
  view.dispatch(tr)
  view.focus()
  return true
}

// Ctrl+S / Cmd+S.
function saveShortcut(onSave) {
  return Extension.create({
    name: 'saveShortcut',
    addKeyboardShortcuts() {
      return {
        'Mod-s': () => {
          onSave?.()
          return true
        }
      }
    }
  })
}

// Mod+Enter leaves a code block, blockquote or table, adding a paragraph below it, so the cursor is
// never stuck inside a block.
function exitBlockInsertParagraphAfter(editor, nodeName) {
  return editor.chain().focus().command(({ tr, dispatch, state }) => {
    if (!dispatch) return false
    const { $from } = state.selection
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name !== nodeName) continue
      const insertPos = $from.after(depth)
      tr.insert(insertPos, state.schema.nodes.paragraph.create())
      tr.setSelection(state.selection.constructor.near(tr.doc.resolve(insertPos + 1)))
      dispatch(tr)
      return true
    }
    return false
  }).run()
}

const ExitBlockExtension = Extension.create({
  name: 'exitBlock',
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': ({ editor }) => {
        if (editor.isActive('codeBlock')) return editor.chain().focus().exitCode().run()
        if (editor.isActive('blockquote')) return exitBlockInsertParagraphAfter(editor, 'blockquote')
        if (editor.isActive('table')) return exitBlockInsertParagraphAfter(editor, 'table')
        return false
      }
    }
  }
})

// Ctrl+\ (or Cmd+\) clears the formatting at the cursor or selection.
const ClearFormattingExtension = Extension.create({
  name: 'clearFormatting',
  addKeyboardShortcuts() {
    return {
      'Ctrl-\\': ({ editor }) => clearCharacterFormattingFromView(editor?.view),
      'Mod-\\': ({ editor }) => clearCharacterFormattingFromView(editor?.view)
    }
  }
})

/** The extensions of every MotoTrace editor. `onSave` runs on Ctrl+S / Cmd+S. */
export function buildEditorExtensions({ placeholder, onSave }) {
  return [
    ...buildContentExtensions(),
    CharacterCount,
    Placeholder.configure({
      placeholder,
      // The placeholder is a class on the empty editor, so it never affects the cursor.
      showOnlyWhenEditable: true,
      showOnlyCurrent: false
    }),
    SlashExtension,
    MarkdownLinkShortcut,
    MarkdownPaste,
    TableColumnWidths,
    ExitBlockExtension,
    ClearFormattingExtension,
    saveShortcut(onSave)
  ]
}
