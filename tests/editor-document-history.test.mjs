import { describe, expect, it } from 'vitest'
import { EditorState } from '@tiptap/pm/state'
import { Schema } from '@tiptap/pm/model'
import { history, undo, redo } from '@tiptap/pm/history'
import { createDocumentState } from '../src/renderer/src/utils/editorDocumentState.js'

const doc = text => schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])])
const schema = new Schema({ nodes: {
  doc: { content: 'paragraph+' },
  paragraph: { content: 'text*' },
  text: {}
} })

describe('document undo isolation', () => {
  it('keeps undo/redo within the selected document after deletion or switching', () => {
    let state = EditorState.create({ schema, doc: doc('Deleted note'), plugins: [history()] })
    state = state.apply(state.tr.insertText(' edited', 13))
    state = createDocumentState(state, doc('My plans'))
    const dispatch = tr => { state = state.apply(tr) }
    expect(undo(state, dispatch)).toBe(false)
    state = state.apply(state.tr.insertText(' supplement', 9))
    expect(undo(state, dispatch)).toBe(true)
    expect(state.doc.textContent).toBe('My plans')
    expect(undo(state, dispatch)).toBe(false)
    expect(redo(state, dispatch)).toBe(true)
    expect(state.doc.textContent).toBe('My plans supplement')
  })

  it('clears redo and history when externally loading a different date or restored content', () => {
    let state = EditorState.create({ schema, doc: doc('Yesterday'), plugins: [history()] })
    state = state.apply(state.tr.insertText('!', 10))
    undo(state, tr => { state = state.apply(tr) })
    state = createDocumentState(state, doc('Today'))
    expect(undo(state)).toBe(false)
    expect(redo(state)).toBe(false)
    expect(state.doc.textContent).toBe('Today')
  })
})
