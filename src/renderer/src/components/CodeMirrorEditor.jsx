import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder, drawSelection } from '@codemirror/view'
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

function countWords(text) {
  if (!text) return 0
  return text.replace(/\s+/g, '').length
}

const CodeMirrorEditor = forwardRef(function CodeMirrorEditor(
  { value = '', onChange, placeholder: ph = '开始记录...', minHeight = '120px', readOnly = false, isFullScreen, onToggleFullScreen, onSave },
  ref
) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [wordCount, setWordCount] = useState(() => countWords(value))
  const wordCountTimerRef = useRef(null)
  
  // Font size setting (persisted locally context for UI simplicity)
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('mototrace_font_size') || '14', 10)
  })

  useEffect(() => {
    localStorage.setItem('mototrace_font_size', fontSize)
  }, [fontSize])

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

  const insertMarkdown = (prefix, suffix = '') => {
    const view = viewRef.current
    if (!view) return
    const { state, dispatch } = view
    const selection = state.selection.main
    const selectedText = state.doc.sliceString(selection.from, selection.to)
    
    // If inserting list or quote, it should go at start of line
    if (prefix.match(/^(\* |1\. |> |---)/)) {
      const line = state.doc.lineAt(selection.from)
      dispatch({
        changes: { from: line.from, insert: prefix },
        selection: { anchor: selection.from + prefix.length, head: selection.to + prefix.length }
      })
    } else {
      dispatch({
        changes: { from: selection.from, to: selection.to, insert: `${prefix}${selectedText}${suffix}` },
        selection: { anchor: selection.from + prefix.length, head: selection.to + prefix.length + selectedText.length }
      })
    }
    view.focus()
  }

  useEffect(() => {
    if (!containerRef.current) return

    const keymapWithSave = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          if (onSave) onSave()
          return true
        }
      },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab
    ])

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        keymapWithSave,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(buildHighlightStyle()),
        buildTheme(),
        EditorView.lineWrapping,
        placeholder(ph),
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const str = update.state.doc.toString()
            if (onChangeRef.current) onChangeRef.current(str)
            
            // Debounced word count
            if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current)
            wordCountTimerRef.current = setTimeout(() => {
              setWordCount(countWords(str))
            }, 500)
          }
        }),
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => view.destroy()
  }, []) // Only create once

  const handleToggleFullScreen = useCallback(() => {
    if (onToggleFullScreen) {
      onToggleFullScreen()
      // Give React a tick to render the new CSS position, then focus
      setTimeout(() => {
        viewRef.current?.focus()
      }, 50)
    }
  }, [onToggleFullScreen])

  // Sync external value changes (e.g. date navigation)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value || '' } })
      setWordCount(countWords(value))
    }
  }, [value])

  return (
    <div className={`cm-editor-shell ${isFullScreen ? 'fullscreen-mode' : ''}`}>
      <div className="cm-toolbar">
        <div className="cm-toolbar-group">
          <button className="cm-tb-btn" onClick={() => insertMarkdown('**', '**')} title="加粗"><b>B</b></button>
          <button className="cm-tb-btn" onClick={() => insertMarkdown('*', '*')} title="斜体"><i>I</i></button>
          <button className="cm-tb-btn" onClick={() => insertMarkdown('~~', '~~')} title="删除线"><s>S</s></button>
          <button className="cm-tb-btn" onClick={() => insertMarkdown('<u>', '</u>')} title="下划线"><u>U</u></button>
        </div>
        <div className="cm-toolbar-group">
          <button className="cm-tb-btn" onClick={() => insertMarkdown('> ')} title="引用">”</button>
          <button className="cm-tb-btn" onClick={() => insertMarkdown('\n---\n')} title="分割线">—</button>
        </div>
        <div className="cm-toolbar-group">
          <button className="cm-tb-btn" onClick={() => insertMarkdown('- [ ] ')} title="待办列表">☑</button>
          <button className="cm-tb-btn" onClick={() => insertMarkdown('* ')} title="无序列表">•</button>
          <button className="cm-tb-btn" onClick={() => insertMarkdown('1. ')} title="有序列表">1.</button>
        </div>
        <div className="cm-toolbar-group">
          <button className="cm-tb-btn" onClick={() => insertMarkdown('\n| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |\n')} title="插入表格">⊞</button>
        </div>
      </div>
      
      <div
        ref={containerRef}
        className="cm-editor-wrapper"
        style={{ minHeight, fontSize: `${fontSize}px` }}
      />

      <div className="cm-footer">
        <span className="cm-word-count">{wordCount} 字</span>
        <div className="cm-footer-actions">
          <span className="font-size-controls">
            <button className="btn btn-ghost btn-xs" onClick={() => setFontSize(Math.max(12, fontSize - 1))}>A-</button>
            <span className="font-size-label">{fontSize}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setFontSize(Math.min(24, fontSize + 1))}>A+</button>
          </span>
          {onToggleFullScreen && (
            <button
              className="btn btn-ghost btn-xs btn-icon"
              onClick={handleToggleFullScreen}
              title={isFullScreen ? '退出全屏 (Esc)' : '全屏输入'}
            >
              {isFullScreen ? '↙' : '↗'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default CodeMirrorEditor
