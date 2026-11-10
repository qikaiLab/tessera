import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AllSelection, TextSelection } from '@tiptap/pm/state'

// editor.isActive() reports false for list nodes when the whole document is selected
// (Ctrl+A), so derive the state from the textblocks inside the selection instead.
function isSelectionInList(editor, listName) {
  const { doc, selection } = editor.state
  let textblocks = 0
  let insideList = 0
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (!node.isTextblock) return true
    const $pos = doc.resolve(pos)
    let inList = false
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === listName) {
        inList = true
        break
      }
    }
    textblocks += 1
    if (inList) insideList += 1
    return false
  })
  return textblocks > 0 && textblocks === insideList
}

// A select-all (AllSelection) makes list toggling wrap the document boundaries
// inconsistently, so run list commands against the equivalent text range instead.
function toggleList(editor, command) {
  const { doc, selection } = editor.state
  const chain = editor.chain().focus()
  if (selection instanceof AllSelection) {
    chain.setTextSelection({ from: TextSelection.atStart(doc).from, to: TextSelection.atEnd(doc).to })
  }
  chain[command]().run()
}

/**
 * Bubble toolbar rendered via ReactDOM.createPortal directly into document.body.
 * This completely escapes any parent stacking context (transform / backdrop-filter /
 * will-change) that would otherwise corrupt position:fixed coordinates.
 *
 * Coordinates come from ProseMirror's coordsAtPos() — viewport-relative,
 * matching position:fixed on document.body perfectly.
 *
 * Key improvements:
 * - Cached toolbar dimensions to avoid layout-thrashing on every selection change
 * - Debounced position updates to prevent jitter
 * - useLayoutEffect for synchronous measurement before paint
 */
export function BubbleToolbar({ editor }) {
  const [visible, setVisible]   = useState(false)
  const [pos, setPos]           = useState({ top: 0, left: 0 })
  const toolbarRef              = useRef(null)
  // Cache the toolbar size so we don't need a DOM read every time
  const cachedSizeRef           = useRef({ w: 280, h: 38 })
  const rafRef                  = useRef(null)
  // Bumped on every refresh so the active state of the buttons tracks the selection,
  // even when the toolbar position itself did not change.
  const [, setRevision]         = useState(0)

  /* ── measure toolbar size once on mount (and on resize) ──────── */
  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (w > 0) cachedSizeRef.current = { w, h }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ── position calculation ─────────────────────────────────────── */
  const update = useCallback(() => {
    if (!editor?.view) return

    // Cancel pending RAF
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!editor?.view) return

      const { from, to } = editor.state.selection
      // A blurred editor keeps its selection: the toolbar belongs to the editor being used, not to
      // an old selection in another card (clicks and keys elsewhere also reach this handler).
      const inUse = editor.isFocused || toolbarRef.current?.contains(document.activeElement)
      if (from === to || !inUse || editor.isActive('codeBlock')) {
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

        // Use cached size — no DOM read here
        const { w: toolbarW, h: toolbarH } = cachedSizeRef.current
        const gap = 8

        // Horizontal: centred over the selection span
        let left = (selLeft + selRight) / 2 - toolbarW / 2

        // Vertical: above selection; flip below if too close to top
        let top = selTop - toolbarH - gap
        if (top < 8) top = selBottom + gap

        // Clamp within viewport
        left = Math.max(8, Math.min(left, window.innerWidth - toolbarW - 8))
        // Clamp vertically too
        top = Math.max(8, Math.min(top, window.innerHeight - toolbarH - 8))

        setPos({ top: Math.round(top), left: Math.round(left) })
        setVisible(true)
        setRevision(revision => revision + 1)
      } catch {
        setVisible(false)
      }
    })
  }, [editor])

  /* ── event wiring ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!editor) return
    const hideOnBlur = () => {
      // Focus moving into the toolbar itself keeps it open; anywhere else closes it.
      requestAnimationFrame(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) setVisible(false)
      })
    }
    // The toolbar is positioned in window coordinates, so scrolling would leave it behind.
    const hideOnScroll = () => setVisible(false)
    editor.on('selectionUpdate', update)
    editor.on('transaction',     update)
    editor.on('blur',            hideOnBlur)
    // mouseup fires after the browser commits the selection
    document.addEventListener('mouseup', update)
    document.addEventListener('keyup',   update)
    window.addEventListener('scroll', hideOnScroll, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction',     update)
      editor.off('blur',            hideOnBlur)
      document.removeEventListener('mouseup', update)
      document.removeEventListener('keyup',   update)
      window.removeEventListener('scroll', hideOnScroll, true)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
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
      className={`bubble-toolbar ${visible ? 'is-visible' : ''}`}
      style={{
        position:      'fixed',
        top:           pos.top,
        left:          pos.left,
        zIndex:        99999,
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
      <div className="bubble-sep" />
      {btn('•',  () => toggleList(editor, 'toggleBulletList'),  isSelectionInList(editor, 'bulletList'),  '无序列表')}
      {btn('1.', () => toggleList(editor, 'toggleOrderedList'), isSelectionInList(editor, 'orderedList'), '有序列表')}
      {btn('☑',  () => toggleList(editor, 'toggleTaskList'),    isSelectionInList(editor, 'taskList'),    '任务列表')}
    </div>
  )

  // Render directly into document.body — bypasses ALL parent stacking contexts
  return createPortal(toolbar, document.body)
}
