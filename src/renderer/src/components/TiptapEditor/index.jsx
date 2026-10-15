import { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleToolbar } from './BubbleToolbar'
import FullscreenHeader from './FullscreenHeader'
import { buildEditorExtensions, clearCharacterFormattingFromView } from './editorExtensions'
import {
  EMPTY_DOC,
  countChars,
  formatCssLetterSpacing,
  formatCssWidth,
  isTaskCheckbox,
  normalizeExternalUrl,
  selectTaskItemUnderPointer
} from './editorHelpers'
import { useEditorContextMenu } from './useEditorContextMenu'
import { useFullscreenEditor } from './useFullscreenEditor'
import { useApp } from '../../context/AppContext'
import { isClearFormattingShortcut, isFullscreenEditorShortcut } from '../../utils/editorShortcuts'
import { replaceEditorDocument } from '../../utils/editorDocumentState'
// Order matters: later files override earlier ones.
import './TiptapEditor.css'
import './BubbleToolbar.css'
import './SlashMenu.css'
import './FullscreenEditor.css'

/**
 * The rich-text editor behind every text card and note. `value` is a Tiptap JSON document (or
 * null) and `onChange` receives the new one. The ref offers focus(), getJSON() and setContent().
 */
const TiptapEditor = forwardRef(function TiptapEditor(
  {
    value = null,
    onChange,
    placeholder = '开始记录...',
    isFullScreen = false,
    fullScreenLeaving = false,   // fullscreen was just switched off; the exit animation is playing
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
    fullscreenStandardWidth,
    fullscreenWideWidth,
    editorLineHeight,
    editorLetterSpacing
  } = useApp()

  // The editor is created once, so its callbacks read the latest props through refs.
  const onSaveRef = useRef(onSave)
  const onChangeRef = useRef(onChange)
  const onToggleFullScreenRef = useRef(onToggleFullScreen)
  const isExternalUpdateRef = useRef(false)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onToggleFullScreenRef.current = onToggleFullScreen }, [onToggleFullScreen])

  const currentMaxWidth = fullscreenWidthMode === 'wide'
    ? formatCssWidth(fullscreenWideWidth, '1000px')
    : formatCssWidth(fullscreenStandardWidth, '700px')

  const editor = useEditor({
    extensions: buildEditorExtensions({ placeholder, onSave: () => onSaveRef.current?.() }),
    content: value || EMPTY_DOC,
    onUpdate: ({ editor }) => {
      if (isExternalUpdateRef.current) return
      onChangeRef.current?.(editor.getJSON())
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

  // Replace the document without reporting it as an edit.
  const loadDocument = useCallback((content) => {
    isExternalUpdateRef.current = true
    replaceEditorDocument(editor, content || EMPTY_DOC)
    isExternalUpdateRef.current = false
  }, [editor])

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus(),
    getJSON: () => editor?.getJSON(),
    setContent: (content) => {
      if (editor) loadDocument(content)
    },
  }))

  // Follow `value` when it changes from outside (e.g. another day was opened). It is compared
  // with the editor's live content: after typing, onChange makes the parent pass back the very
  // same document, which must not be loaded again or the cursor would jump.
  useEffect(() => {
    if (!editor) return
    const nextContent = value || EMPTY_DOC
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(nextContent)) loadDocument(nextContent)
  }, [value, editor, loadDocument])

  useFullscreenEditor({ isFullScreen, fullScreenLeaving, onToggleFullScreen })
  const handleEditorContextMenu = useEditorContextMenu(editor)

  const handleEditorClick = useCallback((event) => {
    const linkEl = event.target?.closest?.('a[href]')
    if (!linkEl) {
      if (!isTaskCheckbox(event.target)) editor?.commands.focus()
      return
    }

    const url = normalizeExternalUrl(linkEl.getAttribute('href'))
    if (!url) return

    event.preventDefault()
    event.stopPropagation()
    window.api?.shell?.openExternal?.(url)
  }, [editor])

  const handleEditorMouseDownCapture = useCallback((event) => {
    selectTaskItemUnderPointer(editor, event.target)
  }, [editor])

  const charCount = countChars(editor)

  useEffect(() => {
    onCharCountChange?.(charCount)
  }, [charCount, onCharCountChange])

  return (
    <div className={`tiptap-shell ${isFullScreen ? 'tiptap-fullscreen' : ''} ${isFullScreen && fullScreenLeaving ? 'is-leaving' : ''}`}>
      {isFullScreen && <div className="tiptap-fullscreen-drag-handle" />}

      <BubbleToolbar editor={editor} />

      {isFullScreen && (
        <FullscreenHeader
          maxWidth={currentMaxWidth}
          charCount={charCount}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
        />
      )}

      {/* Outside the header on purpose: the header's own entrance animation would otherwise
          become the containing block of this fixed button. */}
      {isFullScreen && onToggleFullScreen && (
        <button
          className="fullscreen-exit-btn"
          type="button"
          onClick={onToggleFullScreen}
          title="退出全屏 (Esc)"
          aria-label="退出全屏编辑"
        >
          ✕ 退出全屏
        </button>
      )}

      <div
        className="tiptap-editor-wrapper"
        style={{
          fontSize: `${fontSize}px`,
          maxWidth: isFullScreen ? currentMaxWidth : undefined,
          '--editor-line-height': editorLineHeight || '1.8',
          '--editor-letter-spacing': formatCssLetterSpacing(editorLetterSpacing, '0px')
        }}
        onMouseDownCapture={handleEditorMouseDownCapture}
        onClick={handleEditorClick}
        onContextMenu={handleEditorContextMenu}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

export default TiptapEditor
