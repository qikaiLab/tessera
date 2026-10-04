import { EditorState } from '@tiptap/pm/state'

// Loading another document must never become an undoable edit to this document.
export function createDocumentState(previousState, doc) {
  return EditorState.create({
    schema: previousState.schema,
    doc,
    plugins: previousState.plugins
  })
}

export function replaceEditorDocument(editor, content) {
  editor.commands.setContent(content, { emitUpdate: false })
  editor.view.updateState(createDocumentState(editor.state, editor.state.doc))
}
