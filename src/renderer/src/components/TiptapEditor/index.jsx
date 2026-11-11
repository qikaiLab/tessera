import { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleToolbar } from './BubbleToolbar'
import FullscreenHeader from './FullscreenHeader'
import { buildEditorExtensions, clearCharacterFormattingFromView } from './editorExtensions'
import {
  countChars,
  formatCssLetterSpacing,
  formatCssWidth,
  isTaskCheckbox,
  openLinkHref,
  selectTaskItemUnderPointer
} from './editorHelpers'
import { useEditorContextMenu } from './useEditorContextMenu'
import { useFullscreenEditor } from './useFullscreenEditor'
import { useApp } from '../../context/AppContext'
import { isClearFormattingShortcut, isFullscreenEditorShortcut } from '../../utils/editorShortcuts'
import { prepareDocument } from '../../utils/documentSanitizer'
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
    editorLetterSpacing,
    showToast
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

  // A document this version cannot open as it is (unknown node or mark types) is opened with its text
  // kept, and the user is told: see utils/documentSanitizer.
  const warnRepairedRef = useRef(null)
  warnRepairedRef.current = () => showToast(
    '这段内容含有当前版本不支持的格式，已按文字显示。原始内容在你修改之前不会被覆盖，之后也可在自动历史中找回。',
    'info',
    8000
  )
  const initialContentRef = useRef(null)
  if (initialContentRef.current === null) initialContentRef.current = prepareDocument(value)

  const editor = useEditor({
    extensions: buildEditorExtensions({ placeholder, onSave: () => onSaveRef.current?.() }),
    content: initialContentRef.current.doc,
    onUpdate: ({ editor, transaction }) => {
      if (isExternalUpdateRef.current) return
      // A change made only by the editor's own follow-up rules (the empty paragraph it keeps after a
      // list or table, added when the editor is first focused) is not an edit by the user: it must not
      // rewrite the stored document, least of all one that was opened in a repaired form.
      if (!transaction.docChanged) return
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
    const { doc, repaired } = prepareDocument(content)
    isExternalUpdateRef.current = true
    replaceEditorDocument(editor, doc)
    isExternalUpdateRef.current = false
    if (repaired) warnRepairedRef.current?.()
  }, [editor])

  useEffect(() => {
    if (initialContentRef.current?.repaired) warnRepairedRef.current?.()
  }, [])

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
    // Compared as documents, not as JSON text: the same document can be written two ways (an empty
    // paragraph with or without an empty `content` list).
    let unchanged = false
    try {
      unchanged = editor.state.doc.eq(editor.schema.nodeFromJSON(prepareDocument(value).doc))
    } catch {
      unchanged = false
    }
    if (!unchanged) loadDocument(value)
  }, [value, editor, loadDocument])

  useFullscreenEditor({ isFullScreen, fullScreenLeaving, onToggleFullScreen })
  const handleEditorContextMenu = useEditorContextMenu(editor)

  const handleEditorClick = useCallback((event) => {
    const linkEl = event.target?.closest?.('a[href]')
    if (!linkEl) {
      if (!isTaskCheckbox(event.target)) editor?.commands.focus()
      return
    }

    // Web addresses and local paths are followed; any other link does nothing.
    if (!openLinkHref(linkEl.getAttribute('href'), showToast)) return

    event.preventDefault()
    event.stopPropagation()
  }, [editor, showToast])

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
