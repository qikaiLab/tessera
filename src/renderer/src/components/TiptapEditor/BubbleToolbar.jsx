import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bubble toolbar rendered via ReactDOM.createPortal directly into document.body.
 * This completely escapes any parent stacking context (transform / backdrop-filter /
 * will-change) that would otherwise corrupt position:fixed coordinates.
 *
 * Coordinates come from ProseMirror's coordsAtPos() — viewport-relative,
 * matching position:fixed on document.body perfectly.
 */
export function BubbleToolbar({ editor }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState({ top: 0, left: 0 })
  const toolbarRef            = useRef(null)

  /* ── position calculation ─────────────────────────────────────── */
  const update = useCallback(() => {
    if (!editor?.view) return

    const { from, to } = editor.state.selection
    if (from === to || editor.isActive('codeBlock')) {
      setVisible(false)
      return
    }

    try {
      const start = editor.view.coordsAtPos(from)
      const end   = editor.view.coordsAtPos(Math.max(from, to - 1))

      const selTop    = Math.min(start.top,    end.top)
      const selBottom = Math.max(start.bottom, end.bottom)
      const selLeft   = Math.min(start.left,   end.left)
      const selRight  = Math.max(start.right,  end.right)

      // Read actual rendered size (possible because visibility:hidden keeps layout)
      const el       = toolbarRef.current
      const toolbarW = el?.offsetWidth  || 264
      const toolbarH = el?.offsetHeight || 38
      const gap      = 8

      // Horizontal: centred over the selection span
      let left = (selLeft + selRight) / 2 - toolbarW / 2

      // Vertical: above selection; flip below if too close to top
      let top = selTop - toolbarH - gap
      if (top < 8) top = selBottom + gap

      // Clamp within viewport
      left = Math.max(8, Math.min(left, window.innerWidth - toolbarW - 8))

      setPos({ top: Math.round(top), left: Math.round(left) })
      setVisible(true)
    } catch {
      setVisible(false)
    }
  }, [editor])

  /* ── event wiring ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!editor) return
    editor.on('selectionUpdate', update)
    editor.on('transaction',     update)
    // mouseup fires after the browser commits the selection
    document.addEventListener('mouseup', update)
    document.addEventListener('keyup',   update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction',     update)
      document.removeEventListener('mouseup', update)
      document.removeEventListener('keyup',   update)
    }
  }, [editor, update])

  /* ── hide on outside click ────────────────────────────────────── */
  useEffect(() => {
    const hide = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [])

  /* ── render ───────────────────────────────────────────────────── */
  if (!editor) return null

  const btn = (content, action, isActive, title) => (
    <button
      key={title}
      className={`bubble-btn${isActive ? ' is-active' : ''}`}
      onMouseDown={(e) => { e.preventDefault(); action() }}
      title={title}
    >
      {content}
    </button>
  )

  const toolbar = (
    <div
      ref={toolbarRef}
      className="bubble-toolbar"
      style={{
        position:      'fixed',
        top:           pos.top,
        left:          pos.left,
        zIndex:        99999,
        /* Stay in DOM for offsetWidth measurement; only hide visually */
        visibility:    visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto'    : 'none',
        opacity:       visible ? 1 : 0,
        transform:     visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
        transition:    'opacity 130ms ease, transform 130ms ease',
      }}
    >
      {btn(<b>B</b>, () => editor.chain().focus().toggleBold().run(),      editor.isActive('bold'),               '加粗 (Ctrl+B)')}
      {btn(<i>I</i>, () => editor.chain().focus().toggleItalic().run(),    editor.isActive('italic'),             '斜体 (Ctrl+I)')}
      {btn(<u>U</u>, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'),          '下划线 (Ctrl+U)')}
      {btn(<s>S</s>, () => editor.chain().focus().toggleStrike().run(),    editor.isActive('strike'),             '删除线')}
      <div className="bubble-sep" />
      {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), '标题 1')}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), '标题 2')}
      <div className="bubble-sep" />
      {btn('</>', () => editor.chain().focus().toggleCode().run(),        editor.isActive('code'),               '行内代码')}
      {btn('"',   () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'),         '引用')}
    </div>
  )

  // Render directly into document.body — bypasses ALL parent stacking contexts
  return createPortal(toolbar, document.body)
}
