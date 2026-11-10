import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TableMap, columnResizingPluginKey } from '@tiptap/pm/tables'

export const DEFAULT_COLUMN_WIDTH = 120
const MIN_COLUMN_WIDTH = 72
const MAX_NEW_COLUMN_WIDTH = 200

/** The width of each column of a new table whose columns together fill `availableWidth`. */
export function newTableColumnWidth(cols, availableWidth = 0) {
  const share = availableWidth > 0 ? Math.floor((availableWidth - 1) / cols) : DEFAULT_COLUMN_WIDTH
  return Math.min(MAX_NEW_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, share))
}

/**
 * Which cells of `table` need a `colwidth`, and the widths they get. Every column of a table the
 * user resizes must have a fixed width: when only the dragged column has one, the others follow
 * the width of their text and the table is squeezed to fit its container, so the border runs away
 * from the pointer. `measureCell(offset)` gives the width a cell is drawn at (or 0 when unknown);
 * columns that already have a width keep it. With `onlyResized`, a table with no fixed column at
 * all is left alone. Returns [{ offset, colwidth }], empty when there is nothing to do.
 */
export function planColumnWidths(table, measureCell, minWidth = 1, { onlyResized = false } = {}) {
  const map = TableMap.get(table)
  const widths = new Array(map.width).fill(0)
  const cells = []
  const seen = new Set()
  for (let index = 0; index < map.map.length; index += 1) {
    const offset = map.map[index]
    if (seen.has(offset)) continue
    seen.add(offset)
    cells.push({ offset, column: index % map.width, node: table.nodeAt(offset) })
  }

  let missing = false
  for (const { column, node } of cells) {
    const { colspan, colwidth } = node.attrs
    for (let part = 0; part < colspan; part += 1) {
      if (colwidth?.[part]) widths[column + part] = colwidth[part]
      else missing = true
    }
  }
  if (!missing) return []
  // A table nobody has resized stays as wide as its text; only a resized one is kept fixed.
  if (onlyResized && !widths.some(Boolean)) return []

  // Measure the columns without a width, from cells that cover just that column.
  for (const { offset, column, node } of cells) {
    if (node.attrs.colspan === 1 && !widths[column]) {
      const measured = Math.round(measureCell(offset) || 0)
      if (measured > 0) widths[column] = Math.max(minWidth, measured)
    }
  }
  for (let column = 0; column < widths.length; column += 1) {
    if (!widths[column]) widths[column] = Math.max(minWidth, DEFAULT_COLUMN_WIDTH)
  }

  const patches = []
  for (const { offset, column, node } of cells) {
    const { colspan, colwidth } = node.attrs
    if (colwidth && colwidth.length === colspan && colwidth.every(Boolean)) continue
    patches.push({ offset, colwidth: widths.slice(column, column + colspan) })
  }
  return patches
}

// The table around the cell whose right border the pointer is on, or null.
function tableAroundCell(doc, cellPos) {
  const $cell = doc.resolve(cellPos)
  for (let depth = $cell.depth; depth > 0; depth -= 1) {
    if ($cell.node(depth).type.name === 'table') return { node: $cell.node(depth), start: $cell.start(depth) }
  }
  return null
}

// Sets the planned widths on the cells of the table that starts at `start`.
function applyColumnWidths(tr, start, patches) {
  for (const { offset, colwidth } of patches) {
    const pos = start + offset
    tr.setNodeMarkup(pos, null, { ...tr.doc.nodeAt(pos).attrs, colwidth })
  }
  return tr
}

/**
 * A chain command for right after a table was inserted at the cursor: fixes its columns to
 * equal widths that fill `availableWidth`, so the new table starts out as wide as the line.
 */
export function fixNewTableColumns(availableWidth) {
  return ({ tr, state }) => {
    const found = tableAroundCell(state.doc, state.selection.from)
    if (!found) return false
    const width = newTableColumnWidth(found.node.firstChild?.childCount || 1, availableWidth)
    applyColumnWidths(tr, found.start, planColumnWidths(found.node, () => width, MIN_COLUMN_WIDTH))
    return true
  }
}

/**
 * Keeps the columns of a resized table fixed.
 * - Pressing on a column border first gives every column of that table the width it is drawn
 *   at. The table then keeps its columns apart while one is dragged: it grows past the window
 *   (and scrolls) instead of squeezing the others, and the border follows the pointer.
 * - A row or column added to a resized table gets a width at once, so the table never falls back
 *   to text-sized columns halfway through a session.
 */
export const TableColumnWidths = Extension.create({
  name: 'tableColumnWidths',
  // Before the column resizing plugin, which handles the same mouse press.
  priority: 1000,
  addOptions() {
    return { cellMinWidth: MIN_COLUMN_WIDTH }
  },
  addProseMirrorPlugins() {
    const minWidth = this.options.cellMinWidth
    return [
      new Plugin({
        key: new PluginKey('tableColumnWidths'),
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some(transaction => transaction.docChanged)) return null
          const found = tableAroundCell(newState.doc, newState.selection.from)
          if (!found) return null
          const patches = planColumnWidths(found.node, () => 0, minWidth, { onlyResized: true })
          return patches.length ? applyColumnWidths(newState.tr, found.start, patches) : null
        },
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              const resizing = columnResizingPluginKey.getState(view.state)
              if (event.button !== 0 || !resizing || resizing.activeHandle < 0) return false
              const found = tableAroundCell(view.state.doc, resizing.activeHandle)
              if (!found) return false

              const patches = planColumnWidths(
                found.node,
                offset => view.nodeDOM(found.start + offset)?.getBoundingClientRect?.().width || 0,
                minWidth
              )
              if (!patches.length) return false

              // Layout bookkeeping, not something to undo on its own.
              view.dispatch(applyColumnWidths(view.state.tr, found.start, patches).setMeta('addToHistory', false))
              // Let the column resizing plugin carry on with the press.
              return false
            }
          }
        }
      })
    ]
  }
})
