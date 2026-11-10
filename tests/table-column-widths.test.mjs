import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { buildContentExtensions } from '../src/renderer/src/components/TiptapEditor/contentExtensions.js'
import {
  DEFAULT_COLUMN_WIDTH,
  newTableColumnWidth,
  planColumnWidths
} from '../src/renderer/src/components/TiptapEditor/tableColumnWidths.js'
import RichTextView from '../src/renderer/src/components/RichTextView.jsx'

const schema = getSchema(buildContentExtensions())

const cell = (type, text, attrs) => ({
  type,
  ...(attrs ? { attrs } : {}),
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }]
})
const row = (...cells) => ({ type: 'tableRow', content: cells })
const tableNode = (...rows) => schema.nodeFromJSON({ type: 'table', content: rows })

// What the DOM would report for each cell: the width of its column, by the cell's offset.
function measureBy(table, widthsByColumn) {
  const byOffset = new Map()
  table.forEach((tableRow, rowOffset) => {
    let column = 0
    tableRow.forEach((tableCell, cellOffset) => {
      byOffset.set(rowOffset + 1 + cellOffset, widthsByColumn[column])
      column += tableCell.attrs.colspan
    })
  })
  return offset => byOffset.get(offset) || 0
}

describe('planColumnWidths', () => {
  it('fixes every column at the width it is drawn at, for a table never resized', () => {
    const table = tableNode(
      row(cell('tableHeader', 'A'), cell('tableHeader', 'B'), cell('tableHeader', 'C')),
      row(cell('tableCell', 'x'), cell('tableCell', 'y'), cell('tableCell', 'z'))
    )
    const patches = planColumnWidths(table, measureBy(table, [105, 72.4, 133]), 72)
    expect(patches).toHaveLength(6)
    expect(patches.map(patch => patch.colwidth)).toEqual([[105], [72], [133], [105], [72], [133]])
  })

  it('keeps widths that are already set and only fills the missing ones', () => {
    const table = tableNode(
      row(cell('tableHeader', 'A', { colwidth: [200] }), cell('tableHeader', 'B', { colwidth: [90] }), cell('tableHeader', 'C')),
      row(cell('tableCell', 'x'), cell('tableCell', 'y'), cell('tableCell', 'z'))
    )
    const patches = planColumnWidths(table, measureBy(table, [150, 150, 133]), 72)
    // Cells with their width are left as they are; the rest are brought in line with them.
    expect(patches.map(patch => patch.colwidth)).toEqual([[133], [200], [90], [133]])
  })

  it('does nothing when every column is fixed already', () => {
    const table = tableNode(
      row(cell('tableHeader', 'A', { colwidth: [100] }), cell('tableHeader', 'B', { colwidth: [120] })),
      row(cell('tableCell', 'x', { colwidth: [100] }), cell('tableCell', 'y', { colwidth: [120] }))
    )
    expect(planColumnWidths(table, () => 50, 72)).toEqual([])
  })

  it('never goes below the minimum width, and falls back to a default when unmeasured', () => {
    const table = tableNode(row(cell('tableCell', 'a'), cell('tableCell', 'b')))
    const patches = planColumnWidths(table, measureBy(table, [10, 0]), 72)
    expect(patches.map(patch => patch.colwidth)).toEqual([[72], [DEFAULT_COLUMN_WIDTH]])
  })

  it('gives a column added to a resized table a width, but leaves an unresized table alone', () => {
    const resized = tableNode(
      row(cell('tableHeader', 'A', { colwidth: [200] }), cell('tableHeader', 'B', { colwidth: [90] }), cell('tableHeader', '')),
      row(cell('tableCell', 'x', { colwidth: [200] }), cell('tableCell', 'y', { colwidth: [90] }), cell('tableCell', ''))
    )
    expect(planColumnWidths(resized, () => 0, 72, { onlyResized: true }).map(patch => patch.colwidth))
      .toEqual([[DEFAULT_COLUMN_WIDTH], [DEFAULT_COLUMN_WIDTH]])

    const plain = tableNode(row(cell('tableCell', 'a'), cell('tableCell', 'b')))
    expect(planColumnWidths(plain, () => 0, 72, { onlyResized: true })).toEqual([])
  })

  it('splits a cell that spans two columns across their widths', () => {
    const table = tableNode(
      row(cell('tableHeader', 'wide', { colspan: 2 })),
      row(cell('tableCell', 'a'), cell('tableCell', 'b'))
    )
    const patches = planColumnWidths(table, measureBy(table, [100, 140]), 72)
    expect(patches.find(patch => patch.colwidth.length === 2).colwidth).toEqual([100, 140])
  })
})

describe('newTableColumnWidth', () => {
  it('shares the available width between the columns', () => {
    expect(newTableColumnWidth(3, 500)).toBe(166)
    expect(newTableColumnWidth(4, 500)).toBe(124)
  })

  it('keeps columns comfortable in very wide and very narrow editors', () => {
    expect(newTableColumnWidth(3, 1500)).toBe(200)
    expect(newTableColumnWidth(3, 120)).toBe(72)
    expect(newTableColumnWidth(3)).toBe(DEFAULT_COLUMN_WIDTH)
  })
})

describe('a resized table in a read-only view', () => {
  const render = value => renderToStaticMarkup(React.createElement(RichTextView, { value }))
  const tableDoc = (...rows) => ({ type: 'doc', content: [{ type: 'table', content: rows }] })

  it('keeps its column widths', () => {
    const html = render(tableDoc(
      row(cell('tableHeader', 'A', { colwidth: [150] }), cell('tableHeader', 'B', { colwidth: [90] })),
      row(cell('tableCell', 'x', { colwidth: [150] }), cell('tableCell', 'y', { colwidth: [90] }))
    ))
    expect(html).toContain('<colgroup><col style="width:150px"/><col style="width:90px"/></colgroup>')
    expect(html).toContain('style="width:240px"')
  })

  it('leaves a table that was never resized to size itself', () => {
    const html = render(tableDoc(
      row(cell('tableHeader', 'A'), cell('tableHeader', 'B')),
      row(cell('tableCell', 'x'), cell('tableCell', 'y'))
    ))
    expect(html).not.toContain('<colgroup>')
    expect(html).toContain('<table>')
  })
})
