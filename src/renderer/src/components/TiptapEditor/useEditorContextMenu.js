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
      case 'table-add-row-before':
        editor.chain().focus().addRowBefore().run()
        break
      case 'table-add-row-after':
        editor.chain().focus().addRowAfter().run()
        break
      case 'table-add-column-before':
        editor.chain().focus().addColumnBefore().run()
        break
      case 'table-add-column-after':
        editor.chain().focus().addColumnAfter().run()
        break
      case 'table-delete-row':
        editor.chain().focus().deleteRow().run()
        break
      case 'table-delete-column':
        editor.chain().focus().deleteColumn().run()
        break
      case 'table-merge-cells':
        editor.chain().focus().mergeCells().run()
        break
      case 'table-split-cell':
        editor.chain().focus().splitCell().run()
        break
      case 'table-toggle-header-row':
        editor.chain().focus().toggleHeaderRow().run()
        break
      case 'table-delete':
        editor.chain().focus().deleteTable().run()
        break
      default:
        break
    }
  }, [copySelection, editor, editorId]))

  return useCallback((event) => {
    editor?.commands.focus()
    const hasSelection = Boolean(editor && !editor.state.selection.empty)

    const inTable = Boolean(editor?.isActive('table'))

    showContextMenu(event, [
      { id: 'undo', label: '撤销', enabled: canRunEditorCommand(editor, 'undo') },
      { id: 'redo', label: '重做', enabled: canRunEditorCommand(editor, 'redo') },
      separator,
      { id: 'cut', label: '剪切', enabled: hasSelection },
      { id: 'copy', label: '复制文本', enabled: hasSelection },
      { id: 'paste', label: '粘贴', enabled: hasClipboardText() },
      separator,
      { id: 'select-all', label: '全选', enabled: countChars(editor) > 0 },
      ...(inTable ? [
        separator,
        { id: 'table-add-row-before', label: '在上方插入行', enabled: canRunEditorCommand(editor, 'addRowBefore') },
        { id: 'table-add-row-after', label: '在下方插入行', enabled: canRunEditorCommand(editor, 'addRowAfter') },
        { id: 'table-add-column-before', label: '在左侧插入列', enabled: canRunEditorCommand(editor, 'addColumnBefore') },
        { id: 'table-add-column-after', label: '在右侧插入列', enabled: canRunEditorCommand(editor, 'addColumnAfter') },
        { id: 'table-delete-row', label: '删除当前行', enabled: canRunEditorCommand(editor, 'deleteRow') },
        { id: 'table-delete-column', label: '删除当前列', enabled: canRunEditorCommand(editor, 'deleteColumn') },
        { id: 'table-merge-cells', label: '合并单元格（先拖选多格）', enabled: canRunEditorCommand(editor, 'mergeCells') },
        { id: 'table-split-cell', label: '拆分单元格', enabled: canRunEditorCommand(editor, 'splitCell') },
        { id: 'table-toggle-header-row', label: '切换表头行', enabled: canRunEditorCommand(editor, 'toggleHeaderRow') },
        { id: 'table-delete', label: '删除表格', enabled: canRunEditorCommand(editor, 'deleteTable') }
      ] : [])
    ], { scope: 'tiptap-editor', editorId })
  }, [editor, editorId])
}
