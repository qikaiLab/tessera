import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, placeholder, lineNumbers, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import './CodeMirrorEditor.css'

// Live-preview highlight style
const buildHighlightStyle = () => HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '700', color: 'var(--text-primary)' },
  { tag: tags.heading2, fontSize: '1.35em', fontWeight: '600', color: 'var(--text-primary)' },
  { tag: tags.heading3, fontSize: '1.15em', fontWeight: '600', color: 'var(--text-primary)' },
  { tag: tags.strong, fontWeight: '700', color: 'var(--text-primary)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--text-secondary)' },
  { tag: tags.strikethrough, textDecorationLine: 'line-through', color: 'var(--text-tertiary)' },
  { tag: tags.link, color: 'var(--accent)', textDecorationLine: 'underline', textDecorationColor: 'var(--accent-light)' },
  { tag: tags.url, color: 'var(--accent)' },
  { tag: tags.monospace, fontFamily: 'monospace', background: 'var(--bg-surface-2)', padding: '0 3px', borderRadius: '3px', color: 'var(--text-secondary)' },
  { tag: tags.quote, color: 'var(--text-secondary)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--accent)' },
  { tag: tags.processingInstruction, color: 'var(--text-muted)' },
  { tag: tags.comment, color: 'var(--text-muted)', fontStyle: 'italic' },
])

const buildTheme = () => EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  '.cm-content': {
    padding: '12px 16px',
    caretColor: 'var(--accent)',
    color: 'var(--text-primary)',
    lineHeight: '1.75',
    minHeight: '120px',
  },
  '.cm-focused': { outline: 'none' },
  '.cm-editor': {
    background: 'transparent',
    borderRadius: 'var(--radius-md)',
  },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-activeLine': { background: 'var(--accent-light)', borderRadius: '4px' },
  '.cm-selectionBackground': { background: 'var(--accent-light) !important' },
  '.cm-gutters': { display: 'none' },
  '.cm-placeholder': { color: 'var(--text-muted)', fontStyle: 'italic' },
  '&.cm-focused .cm-selectionBackground': { background: 'var(--accent-light) !important' },
})

const CodeMirrorEditor = forwardRef(function CodeMirrorEditor(
  { value = '', onChange, placeholder: ph = '开始记录...', minHeight = '120px', readOnly = false },
  ref
) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    getValue: () => viewRef.current?.state?.doc?.toString() || '',
    setValue: (v) => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
    }
  }))

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(buildHighlightStyle()),
        buildTheme(),
        EditorView.lineWrapping,
        placeholder(ph),
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of(update => {
          if (update.docChanged && onChangeRef.current) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => view.destroy()
  }, []) // Only create once

  // Sync external value changes (e.g. date navigation)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value || '' } })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      className="cm-editor-wrapper"
      style={{ minHeight }}
    />
  )
})

export default CodeMirrorEditor
