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
import { useApp } from '../../context/AppContext'
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
    fontSize = 14,
    onFontSizeChange,
    onCharCountChange,
  },
  ref
) {
  const {
    fullscreenWidthMode,
    updateFullscreenWidthMode,
    fullscreenStandardWidth,
    fullscreenWideWidth,
    editorLineHeight,
    editorLetterSpacing
  } = useApp()

  const onSaveRef = useRef(onSave)
  const onChangeRef = useRef(onChange)
  const isExternalUpdateRef = useRef(false)

  const formatCSSWidth = (val, fallback = '700px') => {
    if (!val) return fallback
    const trimmed = val.trim()
    if (/^\d+$/.test(trimmed)) {
      return trimmed + 'px'
    }
    return trimmed
  }

  const formatCSSLetterSpacing = (val, fallback = '0px') => {
    if (!val) return fallback
    const trimmed = val.trim()
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return trimmed + 'px'
    }
    return trimmed
  }

  const currentMaxWidth = fullscreenWidthMode === 'wide'
    ? formatCSSWidth(fullscreenWideWidth, '1000px')
    : formatCSSWidth(fullscreenStandardWidth, '700px')

  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

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

  // Sync external value (e.g., date change).
  // Fix: compare against editor's *live* content via getJSON() instead of a
  // stale prevValueRef. After user input, onUpdate → onChange(json) → parent
  // re-renders with the same JSON as `value`. At that point editor.getJSON()
  // already equals value, so setContent is skipped and the cursor is preserved.
  // setContent is only called when the value truly changed externally (e.g.,
  // the user navigated to a different date).
  useEffect(() => {
    if (!editor) return
    const nextContent = value || { type: 'doc', content: [{ type: 'paragraph' }] }
    const currentStr = JSON.stringify(editor.getJSON())
    const nextStr    = JSON.stringify(nextContent)
    if (currentStr !== nextStr) {
      isExternalUpdateRef.current = true
      editor.commands.setContent(nextContent)
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

  useEffect(() => {
    onCharCountChange?.(charCount)
  }, [charCount, onCharCountChange])

  return (
    <div className={`tiptap-shell ${isFullScreen ? 'tiptap-fullscreen' : ''}`}>
      {isFullScreen && <div className="tiptap-fullscreen-drag-handle" />}

      {/* Bubble Menu */}
      <BubbleToolbar editor={editor} />

      {/* Fullscreen Header (instead of floating close button + bottom footer) */}
      {isFullScreen && (
        <div className="tiptap-fullscreen-header" style={{ maxWidth: currentMaxWidth }}>
          <span className="tiptap-char-count">{charCount} 字</span>
          <div className="tiptap-fullscreen-header-actions">
            <button
              className="btn btn-ghost btn-xs tiptap-width-toggle"
              onClick={() => updateFullscreenWidthMode(fullscreenWidthMode === 'standard' ? 'wide' : 'standard')}
              title={fullscreenWidthMode === 'standard' ? '切换为宽幅宽度' : '切换为标准行宽'}
              style={{ marginRight: '8px' }}
            >
              {fullscreenWidthMode === 'standard' ? '↔ 宽屏' : '→← 标准'}
            </button>
            <span className="tiptap-font-controls">
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => onFontSizeChange?.(Math.max(12, fontSize - 1))}
                title="缩小字体"
              >
                A−
              </button>
              <span className="tiptap-font-label">{fontSize}</span>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => onFontSizeChange?.(Math.min(24, fontSize + 1))}
                title="放大字体"
              >
                A+
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Exit Button at the very top right of the viewport */}
      {isFullScreen && onToggleFullScreen && (
        <button
          className="fullscreen-exit-btn"
          onClick={handleToggleFullScreen}
          title="退出全屏 (Esc)"
        >
          ✕ 退出全屏
        </button>
      )}

      {/* Editor Area */}
      <div
        className="tiptap-editor-wrapper"
        style={{
          fontSize: `${fontSize}px`,
          maxWidth: isFullScreen ? currentMaxWidth : undefined,
          '--editor-line-height': editorLineHeight || '1.8',
          '--editor-letter-spacing': formatCSSLetterSpacing(editorLetterSpacing, '0px')
        }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

export default TiptapEditor
