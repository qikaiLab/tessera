import { useCallback } from 'react'
import { editMenuItems, separator, showContextMenu, useContextMenuCommand } from '../../utils/contextMenu'
import { storedText } from '../../utils/dayEntries'
import { focusEditableTarget, getEditableSelectionState } from '../../utils/editableText'
import './NumberInput.css'

const isNumericText = (value) => /^-?\d+(\.\d+)?$/.test(storedText(value || '').trim())

// `pending`: the value to start from (the last recorded number) is still being looked up, so the
// field is locked: a press on + or - would otherwise act on the placeholder 0.
export default function NumberInput({ sectionId, value, pending = false, unit, onChange, onUseRecentValue, showToast }) {
  const numVal = value === '' ? '' : storedText(value)

  const handleChange = (e) => {
    const v = e.target.value
    if (v === '' || /^-?\d*\.?\d*$/.test(v)) onChange(v)
  }

  const increment = (delta) => {
    const n = parseFloat(numVal) || 0
    onChange(String(parseFloat((n + delta).toFixed(4))))
  }

  useContextMenuCommand('today-number', useCallback(async (id, context) => {
    if (context?.sectionId !== sectionId) return

    if (id === 'reset-zero') {
      onChange('0')
      return
    }

    if (id === 'use-recent') {
      const recentValue = await onUseRecentValue?.()
      onChange(String(recentValue ?? '0'))
      return
    }

    if (id === 'copy-value') {
      if (pending) return
      window.api?.clipboard?.writeText?.(numVal || '0')
      showToast?.('已复制数值', 'success', 1000)
      return
    }

    if (id === 'paste-number') {
      const text = window.api?.clipboard?.readText?.() || ''
      const trimmed = text.trim()
      if (isNumericText(trimmed)) {
        onChange(trimmed)
      }
    }
  }, [numVal, onChange, onUseRecentValue, pending, sectionId, showToast]))

  const handleContextMenu = async (event) => {
    const clipboardText = window.api?.clipboard?.readText?.() || ''
    const canPasteNumber = isNumericText(clipboardText)
    const selectionState = getEditableSelectionState(event.target)
    const isInputMenu = Boolean(selectionState?.target?.matches?.('input, textarea'))
    if (isInputMenu) focusEditableTarget(selectionState.target)

    const textMenuItems = isInputMenu
      ? [
          ...editMenuItems({
            canUndo: selectionState.canUndo,
            canRedo: selectionState.canRedo,
            canCut: selectionState.canCut,
            canCopy: selectionState.canCopy,
            canPaste: selectionState.canPaste && canPasteNumber,
            canSelectAll: selectionState.canSelectAll
          }),
          separator
        ]
      : []

    showContextMenu(event, [
      ...textMenuItems,
      { id: 'reset-zero', label: '重置为 0' },
      { id: 'use-recent', label: '使用最近一次数值' },
      separator,
      { id: 'copy-value', label: '复制数值' },
      { id: 'paste-number', label: '粘贴', visible: !isInputMenu && canPasteNumber }
    ], {
      scope: 'today-number',
      sectionId
    })
  }

  return (
    <div className="number-input-wrap" aria-busy={pending || undefined} onContextMenu={handleContextMenu}>
      <button className="num-btn" disabled={pending} onClick={() => increment(-1)}>−</button>
      <input
        className="input number-input selectable"
        type="text"
        inputMode="decimal"
        value={numVal}
        readOnly={pending}
        onChange={handleChange}
        placeholder="0"
      />
      <button className="num-btn" disabled={pending} onClick={() => increment(1)}>+</button>
      {unit && <span className="number-unit">{unit}</span>}
    </div>
  )
}
