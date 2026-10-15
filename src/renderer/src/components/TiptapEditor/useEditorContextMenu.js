import { useCallback, useId } from 'react'
import { separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'
import { hasClipboardText } from '../../utils/editableText'
import { canRunEditorCommand, countChars, getSelectedEditorText, insertPlainText } from './editorHelpers'

/**
 * The editor's right-click menu: shows it and runs the chosen command. Returns the
 * `onContextMenu` handler for the editor's wrapper.
 */
export function useEditorContextMenu(editor) {
  // Several editors can be on screen; the command comes back tagged with the one it was for.
  const editorId = useId()

  const copySelection = useCallback(() => {
    const selectedText = getSelectedEditorText(editor)
    if (!selectedText) return false
    window.api?.clipboard?.writeText?.(selectedText)
    return true
  }, [editor])

  useContextMenuCommand('tiptap-editor', useCallback((id, context) => {
    if (context?.editorId !== editorId || !editor) return

    switch (id) {
      case 'undo':
        editor.chain().focus().undo().run()
        break
      case 'redo':
        editor.chain().focus().redo().run()
        break
      case 'cut':
        if (copySelection()) editor.chain().focus().deleteSelection().run()
        break
      case 'copy':
        copySelection()
        break
      case 'paste':
        insertPlainText(editor, window.api?.clipboard?.readText?.() || '')
        break
      case 'select-all':
        editor.chain().focus().selectAll().run()
        break
      default:
        break
    }
  }, [copySelection, editor, editorId]))

  return useCallback((event) => {
    editor?.commands.focus()
    const hasSelection = Boolean(editor && !editor.state.selection.empty)

    showContextMenu(event, [
      { id: 'undo', label: '撤销', enabled: canRunEditorCommand(editor, 'undo') },
      { id: 'redo', label: '重做', enabled: canRunEditorCommand(editor, 'redo') },
      separator,
      { id: 'cut', label: '剪切', enabled: hasSelection },
      { id: 'copy', label: '复制文本', enabled: hasSelection },
      { id: 'paste', label: '粘贴', enabled: hasClipboardText() },
      separator,
      { id: 'select-all', label: '全选', enabled: countChars(editor) > 0 }
    ], { scope: 'tiptap-editor', editorId })
  }, [editor, editorId])
}
