import React, { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { BubbleToolbar } from './BubbleToolbar'
import { SlashExtension } from './slashExtension'
import { useApp } from '../../context/AppContext'
import { separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'
import { isFullscreenEditorShortcut } from '../../utils/editorShortcuts'
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

/**
 * ClearFormatting extension:
 * - Ctrl-\ or Mod-\: clear all marks at the cursor or selection.
 */
const ClearFormattingExtension = Extension.create({
  name: 'clearFormatting',
  addKeyboardShortcuts() {
    return {
      'Ctrl-\\': ({ editor }) => {
        return clearCharacterFormatting(editor)
      },
      'Mod-\\': ({ editor }) => {
        return clearCharacterFormatting(editor)
      },
    }
  },
})

function countChars(editor) {
  if (!editor) return 0
  return editor.storage.characterCount?.characters?.() ?? 0
}

function canRunEditorCommand(editor, command) {
  try {
    const can = editor?.can?.()
    return typeof can?.[command] === 'function' ? can[command]() : true
  } catch {
    return true
  }
}

function getSelectedEditorText(editor) {
  const selection = editor?.state?.selection
  if (!editor || !selection || selection.empty) return ''
  return editor.state.doc.textBetween(selection.from, selection.to, '\n\n')
}

function insertPlainText(editor, text) {
  if (!editor) return false
  return editor.chain().focus().command(({ state, dispatch }) => {
    if (dispatch) {
      dispatch(state.tr.insertText(String(text ?? ''), state.selection.from, state.selection.to))
    }
    return true
  }).run()
}

function normalizeExternalUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
    return trimmed
  }
  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return null
}

const ExternalLink = Link.extend({
  inclusive: false,
})

function isClearFormattingShortcut(event) {
  if (event.altKey || event.shiftKey) return false
  if (!event.ctrlKey && !event.metaKey) return false
  return event.code === 'Backslash' || event.key === '\\'
}

function clearCharacterFormattingFromView(view) {
  if (!view) return false

  const { state } = view
  const { selection, schema } = state
  const markTypes = Object.values(schema.marks)
  let tr = state.tr

  if (!selection.empty) {
    markTypes.forEach(markType => {
      tr = tr.removeMark(selection.from, selection.to, markType)
    })
  }

  tr = tr.setStoredMarks([])
  view.dispatch(tr)
  view.focus()
  return true
}

function clearCharacterFormatting(editor) {
  return clearCharacterFormattingFromView(editor?.view)
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
  const onToggleFullScreenRef = useRef(onToggleFullScreen)
  const isExternalUpdateRef = useRef(false)
  // Fix #11: Track setTimeout IDs for cleanup
  const toggleTimeoutRef = useRef(null)
  const contextMenuIdRef = useRef(`tiptap-${Date.now()}-${Math.random().toString(36).slice(2)}`)

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
  useEffect(() => { onToggleFullScreenRef.current = onToggleFullScreen }, [onToggleFullScreen])

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
      ExternalLink.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: null,
        },
      }),
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
      ClearFormattingExtension,
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
      handleKeyDown: (view, event) => {
        if (isFullscreenEditorShortcut(event) && onToggleFullScreenRef.current) {
          event.preventDefault()
          onToggleFullScreenRef.current()
          return true
        }
        if (!isClearFormattingShortcut(event)) return false
        event.preventDefault()
        return clearCharacterFormattingFromView(view)
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
    // Fix #11: Track timeout and clean previous one
    if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current)
    toggleTimeoutRef.current = setTimeout(() => {
      editor?.commands.focus()
      toggleTimeoutRef.current = null
    }, 80)
  }, [onToggleFullScreen, editor])

  // Keyboard shortcuts while fullscreen: Esc exits; Ctrl/Cmd+Shift+Enter toggles.
  useEffect(() => {
    if (!isFullScreen) return
    const handleKey = (e) => {
      if (e.key === 'Escape' || (!e.defaultPrevented && isFullscreenEditorShortcut(e))) {
        e.preventDefault()
        handleToggleFullScreen()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      // Fix #11: Clean up pending timeout when effect is torn down
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current)
        toggleTimeoutRef.current = null
      }
    }
  }, [isFullScreen, handleToggleFullScreen])

  const handleEditorClick = useCallback((event) => {
    const linkEl = event.target?.closest?.('a[href]')
    if (!linkEl) {
      editor?.commands.focus()
      return
    }

    const url = normalizeExternalUrl(linkEl.getAttribute('href'))
    if (!url) return

    event.preventDefault()
    event.stopPropagation()
    window.api?.shell?.openExternal?.(url)
  }, [editor])

  const copyEditorSelection = useCallback(() => {
    const selectedText = getSelectedEditorText(editor)
    if (!selectedText) return false
    window.api?.clipboard?.writeText?.(selectedText)
    return true
  }, [editor])

  useContextMenuCommand('tiptap-editor', useCallback(async (id, context) => {
    if (context?.editorId !== contextMenuIdRef.current || !editor) return

    if (id === 'undo') {
      editor.chain().focus().undo().run()
      return
    }

    if (id === 'redo') {
      editor.chain().focus().redo().run()
      return
    }

    if (id === 'cut') {
      if (copyEditorSelection()) editor.chain().focus().deleteSelection().run()
      return
    }

    if (id === 'copy') {
      copyEditorSelection()
      return
    }

    if (id === 'paste') {
      const text = window.api?.clipboard?.readText?.() || ''
      insertPlainText(editor, text)
      return
    }

    if (id === 'select-all') {
      editor.chain().focus().selectAll().run()
    }
  }, [copyEditorSelection, editor]))

  const handleEditorContextMenu = useCallback((event) => {
    editor?.commands.focus()
    const hasSelection = Boolean(editor && !editor.state.selection.empty)

    showContextMenu(event, [
      { id: 'undo', label: '撤销', enabled: canRunEditorCommand(editor, 'undo') },
      { id: 'redo', label: '重做', enabled: canRunEditorCommand(editor, 'redo') },
      separator,
      { id: 'cut', label: '剪切', enabled: hasSelection },
      { id: 'copy', label: '复制', enabled: hasSelection },
      { id: 'paste', label: '粘贴' },
      separator,
      { id: 'select-all', label: '全选', enabled: countChars(editor) > 0 }
    ], {
      scope: 'tiptap-editor',
      editorId: contextMenuIdRef.current
    })
  }, [editor])

  const charCount = countChars(editor)

  useEffect(() => {
    onCharCountChange?.(charCount)
  }, [charCount, onCharCountChange])

  useEffect(() => {
    if (!isFullScreen) return

    document.body.classList.add('editor-fullscreen-active')
    return () => {
      document.body.classList.remove('editor-fullscreen-active')
    }
  }, [isFullScreen])

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
          type="button"
          onClick={handleToggleFullScreen}
          title="退出全屏 (Esc)"
          aria-label="退出全屏编辑"
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
        onClick={handleEditorClick}
        onContextMenu={handleEditorContextMenu}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

export default TiptapEditor
