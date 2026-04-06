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

    // Use the native browser selection to get pixel coords
    const domSelection = window.getSelection()
    if (!domSelection || domSelection.rangeCount === 0) {
      setVisible(false)
      return
    }

    const range = domSelection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (!rect || rect.width === 0) {
      setVisible(false)
      return
    }

    const toolbarWidth = 280 // approximate
    const toolbarHeight = 40
    const offset = 8

    let left = rect.left + rect.width / 2 - toolbarWidth / 2
    let top = rect.top - toolbarHeight - offset + window.scrollY

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8))

    setPos({ top, left })
    setVisible(true)
  }, [editor])

  useEffect(() => {
    if (!editor) return

    // Listen on Tiptap's transaction updates
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    // Also on mouseup/keyup for immediate response
    document.addEventListener('mouseup', update)
    document.addEventListener('keyup', update)

    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      document.removeEventListener('mouseup', update)
      document.removeEventListener('keyup', update)
    }
  }, [editor, update])

  // Hide on click outside
  useEffect(() => {
    const hide = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [])

  if (!editor || !visible) return null

  const btn = (label, action, isActive, title) => (
    <button
      key={label}
      className={`bubble-btn ${isActive ? 'is-active' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault() // Prevent losing selection
        action()
      }}
      title={title}
    >
      {label}
    </button>
  )

  return (
    <div
      ref={toolbarRef}
      className="bubble-toolbar"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9000 }}
    >
      {btn(<b>B</b>, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), '加粗 (Ctrl+B)')}
      {btn(<i>I</i>, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), '斜体 (Ctrl+I)')}
      {btn(<u>U</u>, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), '下划线 (Ctrl+U)')}
      {btn(<s>S</s>, () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), '删除线')}
      <div className="bubble-sep" />
      {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), '标题 1')}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), '标题 2')}
      <div className="bubble-sep" />
      {btn('</>', () => editor.chain().focus().toggleCode().run(), editor.isActive('code'), '行内代码')}
      {btn('"', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), '引用')}
    </div>
  )
}
