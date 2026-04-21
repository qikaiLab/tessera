import React, { useEffect, useCallback, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { BubbleToolbar } from './BubbleToolbar'
import { SlashExtension } from './slashExtension'
import './TiptapEditor.css'

// Custom save extension (Ctrl+S / Cmd+S)
function buildSaveExtension(onSave) {
  return Extension.create({
    name: 'saveShortcut',
    addKeyboardShortcuts() {
      return {
        'Mod-s': () => {
          onSave?.()
          return true
        },
      }
    },
  })
}

/**
 * ExitBlock extension:
 * - Mod+Enter: exit code block / blockquote → insert paragraph below
 * - Shift+Enter in code block: insert a hard line break (soft newline)
 * - This solves the "stuck in a block" UX issue
 */
const ExitBlockExtension = Extension.create({
  name: 'exitBlock',
  addKeyboardShortcuts() {
    return {
      // Mod+Enter: exit code block or blockquote, insert paragraph after
      'Mod-Enter': ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Check if we're inside a code block
        if (editor.isActive('codeBlock')) {
          return editor.chain().focus().exitCode().run()
        }

        // Check if we're inside a blockquote
        if (editor.isActive('blockquote')) {
          // Move to end of blockquote then insert paragraph after
          return editor
            .chain()
            .focus()
            .command(({ tr, dispatch, state }) => {
              if (dispatch) {
                // Find the blockquote node and insert a paragraph after it
                const { $from } = state.selection
                let depth = $from.depth
                while (depth > 0) {
                  const node = $from.node(depth)
                  if (node.type.name === 'blockquote') {
                    const blockquoteEnd = $from.end(depth)
                    const insertPos = $from.after(depth)
                    const paragraph = state.schema.nodes.paragraph.create()
                    tr.insert(insertPos, paragraph)
                    tr.setSelection(
                      state.selection.constructor.near(tr.doc.resolve(insertPos + 1))
                    )
                    dispatch(tr)
                    return true
                  }
                  depth--
                }
              }
              return false
            })
            .run()
        }

        return false
      },
    }
  },
})

function countChars(editor) {
  if (!editor) return 0
  return editor.storage.characterCount?.characters?.() ?? 0
}

const TiptapEditor = forwardRef(function TiptapEditor(
  {
    value = null,        // JSON object or null
    onChange,            // (jsonValue) => void
    placeholder = '开始记录...',
    isFullScreen = false,
    onToggleFullScreen,
    onSave,
  },
  ref
) {
  const onSaveRef = useRef(onSave)
  const onChangeRef = useRef(onChange)
  const isExternalUpdateRef = useRef(false)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('mototrace_font_size') || '14', 10)
  })

  useEffect(() => {
    localStorage.setItem('mototrace_font_size', String(fontSize))
  }, [fontSize])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // History is included by default
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
        // Disable hardBreak default Shift+Enter shortcut so we can re-add it cleanly
        hardBreak: {
          keepMarks: true,
        },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Placeholder.configure({
        placeholder,
        // Use emptyEditorClass (not float trick) so placeholder doesn't affect cursor
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
      SlashExtension,
      ExitBlockExtension,
      buildSaveExtension(() => onSaveRef.current?.()),
    ],
    content: value || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor }) => {
      if (isExternalUpdateRef.current) return
      const json = editor.getJSON()
      onChangeRef.current?.(json)
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content selectable',
        spellcheck: 'false',
      },
    },
  })

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus(),
    getJSON: () => editor?.getJSON(),
    setContent: (content) => {
      if (editor) {
        isExternalUpdateRef.current = true
        editor.commands.setContent(content || { type: 'doc', content: [{ type: 'paragraph' }] })
        isExternalUpdateRef.current = false
      }
    },
  }))

  // Sync external value (e.g., date change)
  const prevValueRef = useRef(value)
  useEffect(() => {
    if (!editor) return
    // Deep equality check using JSON string
    const prevStr = JSON.stringify(prevValueRef.current)
    const nextStr = JSON.stringify(value)
    if (prevStr !== nextStr) {
      prevValueRef.current = value
      isExternalUpdateRef.current = true
      editor.commands.setContent(value || { type: 'doc', content: [{ type: 'paragraph' }] })
      isExternalUpdateRef.current = false
    }
  }, [value, editor])

  // Focus after fullscreen toggle
  const handleToggleFullScreen = useCallback(() => {
    onToggleFullScreen?.()
    setTimeout(() => editor?.commands.focus(), 80)
  }, [onToggleFullScreen, editor])

  // Keyboard shortcut: Esc to exit fullscreen
  useEffect(() => {
    if (!isFullScreen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleToggleFullScreen()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFullScreen, handleToggleFullScreen])

  const charCount = countChars(editor)

  return (
    <div className={`tiptap-shell ${isFullScreen ? 'tiptap-fullscreen' : ''}`}>
      {/* Bubble Menu */}
      <BubbleToolbar editor={editor} />

      {/* Fullscreen exit overlay button */}
      {isFullScreen && (
        <button
          className="tiptap-fullscreen-exit-btn"
          onClick={handleToggleFullScreen}
          title="退出全屏 (Esc)"
        >
          <span className="tiptap-fullscreen-exit-icon">✕</span>
          <span className="tiptap-fullscreen-exit-label">退出全屏</span>
        </button>
      )}

      {/* Editor Area */}
      <div
        className="tiptap-editor-wrapper"
        style={{ fontSize: `${fontSize}px` }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="tiptap-footer">
        <span className="tiptap-char-count">{charCount} 字</span>
        <div className="tiptap-footer-actions">
          {!isFullScreen && (
            <span className="tiptap-hint">输入 <kbd>/</kbd> 插入块 &nbsp;·&nbsp; <kbd>Mod+↵</kbd> 跳出块</span>
          )}
          <span className="tiptap-font-controls">
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setFontSize(s => Math.max(12, s - 1))}
              title="缩小字体"
            >
              A−
            </button>
            <span className="tiptap-font-label">{fontSize}</span>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setFontSize(s => Math.min(24, s + 1))}
              title="放大字体"
            >
              A+
            </button>
          </span>
          {onToggleFullScreen && (
            <button
              className="btn btn-ghost btn-xs btn-icon"
              onClick={handleToggleFullScreen}
              title={isFullScreen ? '退出全屏 (Esc)' : '全屏写作 (专注模式)'}
            >
              {isFullScreen ? '↙' : '↗'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default TiptapEditor
