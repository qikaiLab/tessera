import React, { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Pure React bubble toolbar — no external dependency.
 * Detects text selection within the ProseMirror editor and positions itself
 * directly above the selection using the native Selection API.
 */
export function BubbleToolbar({ editor }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const toolbarRef = useRef(null)

  const update = useCallback(() => {
    if (!editor) return

    const { from, to } = editor.state.selection
    const hasSelection = from !== to
    const inCodeBlock = editor.isActive('codeBlock')

    if (!hasSelection || inCodeBlock) {
      setVisible(false)
      return
    }

    const domSelection = window.getSelection()
    if (!domSelection || domSelection.rangeCount === 0) {
      setVisible(false)
      return
    }

    const range = domSelection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // rect values are 0 if nothing is in DOM yet, or selection collapsed
    if (!rect || rect.width === 0 || rect.height === 0) {
      setVisible(false)
      return
    }

    // position: fixed uses viewport coords — NO scrollY adjustment needed
    const toolbarEl = toolbarRef.current
    const toolbarW = toolbarEl ? toolbarEl.offsetWidth : 0
    const toolbarH = toolbarEl ? toolbarEl.offsetHeight : 38
    const gap = 8

    // Horizontally center the toolbar above the selection midpoint
    let left = rect.left + rect.width / 2 - toolbarW / 2
    // Vertically: prefer above; fall back to below if not enough room
    let top = rect.top - toolbarH - gap

    if (top < 4) {
      // Not enough space above — place below selection
      top = rect.bottom + gap
    }

    // Clamp horizontally to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarW - 8))

    setPos({ top: Math.round(top), left: Math.round(left) })
    setVisible(true)
  }, [editor])

  useEffect(() => {
    if (!editor) return

    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    document.addEventListener('mouseup', update)
    document.addEventListener('keyup', update)

    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      document.removeEventListener('mouseup', update)
      document.removeEventListener('keyup', update)
    }
  }, [editor, update])

  // Hide when clicking outside the toolbar
  useEffect(() => {
    const hide = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [])

  if (!editor) return null

  const btn = (content, action, isActive, title) => (
    <button
      key={title}
      className={`bubble-btn ${isActive ? 'is-active' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault() // Keep selection alive
        action()
      }}
      title={title}
    >
      {content}
    </button>
  )

  return (
    <div
      ref={toolbarRef}
      className="bubble-toolbar"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9000,
        // Invisible but layout-able before first open, so offsetWidth is measurable
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {btn(<b>B</b>,  () => editor.chain().focus().toggleBold().run(),      editor.isActive('bold'),                 '加粗 (Ctrl+B)')}
      {btn(<i>I</i>,  () => editor.chain().focus().toggleItalic().run(),    editor.isActive('italic'),               '斜体 (Ctrl+I)')}
      {btn(<u>U</u>,  () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'),            '下划线 (Ctrl+U)')}
      {btn(<s>S</s>,  () => editor.chain().focus().toggleStrike().run(),    editor.isActive('strike'),               '删除线')}
      <div className="bubble-sep" />
      {btn('H1',      () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), '标题 1')}
      {btn('H2',      () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), '标题 2')}
      <div className="bubble-sep" />
      {btn('</>', () => editor.chain().focus().toggleCode().run(),           editor.isActive('code'),                 '行内代码')}
      {btn('"',   () => editor.chain().focus().toggleBlockquote().run(),    editor.isActive('blockquote'),           '引用')}
    </div>
  )
}
