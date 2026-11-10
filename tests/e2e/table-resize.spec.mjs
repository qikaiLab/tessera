import { test, expect, launchApp } from './fixtures.mjs'

const EDITOR = '.sections-grid .ProseMirror'

async function openTable(app, window, { windowWidth } = {}) {
  await window.evaluate(() => window.api.config.set('onboardingDone', true))
  await window.reload()
  await window.waitForSelector('.sidebar')
  if (windowWidth) {
    await app.evaluate(({ BrowserWindow }, width) => {
      const target = BrowserWindow.getAllWindows()[0]
      target.setMinimumSize(300, 300)
      target.setSize(width, 800)
    }, windowWidth)
    await window.waitForTimeout(400)
  }
  await window.locator(EDITOR).first().click()
  await window.keyboard.type('/表格')
  await window.keyboard.press('Enter')
  await window.waitForSelector(`${EDITOR} table`)
}

// Column widths of the first row, the table width and whether its wrapper scrolls.
function measure(window) {
  return window.evaluate(() => {
    const table = document.querySelector('.ProseMirror table')
    const wrapper = table.closest('.tableWrapper')
    return {
      columns: [...table.querySelectorAll('tr:first-child > *')].map(cell => Math.round(cell.getBoundingClientRect().width)),
      table: Math.round(table.getBoundingClientRect().width),
      wrapper: Math.round(wrapper.getBoundingClientRect().width),
      scrolls: wrapper.scrollWidth > wrapper.clientWidth
    }
  })
}

// Drags the right border of the given column of the first row by `delta` pixels, in small steps.
async function dragBorder(window, column, delta, steps = 10) {
  const box = await window.locator(`${EDITOR} table tr:first-child > *`).nth(column).boundingBox()
  const x = box.x + box.width - 1
  const y = box.y + box.height / 2
  await window.mouse.move(x - 8, y)
  await window.mouse.move(x, y)
  await window.mouse.down()
  const trail = []
  for (let step = 1; step <= steps; step += 1) {
    await window.mouse.move(x + (delta * step) / steps, y)
    trail.push(await measure(window))
  }
  await window.mouse.up()
  return trail
}

test('a new table fills the line with equal, fixed columns', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await openTable(app, window)
    const { columns, table, wrapper } = await measure(window)
    expect(new Set(columns).size).toBe(1)
    expect(columns[0]).toBeGreaterThanOrEqual(72)
    expect(table).toBeLessThanOrEqual(wrapper)
    // Every column carries a fixed width in the document.
    const widths = await window.locator(`${EDITOR} table col`).evaluateAll(cols => cols.map(col => col.style.width))
    expect(widths.every(width => /px$/.test(width))).toBe(true)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

for (const column of [0, 1, 2]) {
  test(`dragging the border of column ${column + 1} moves only that column, following the pointer`, async ({ sandbox }) => {
    const { app, window, problems } = await launchApp(sandbox)
    try {
      await openTable(app, window)
      const before = await measure(window)
      const trail = await dragBorder(window, column, 60)

      for (const [index, state] of trail.entries()) {
        // The dragged column grows with the pointer; the others do not move at all.
        expect(state.columns[column]).toBeGreaterThanOrEqual(before.columns[column] + Math.floor((60 * (index + 1)) / 10) - 2)
        expect(state.columns[column]).toBeLessThanOrEqual(before.columns[column] + Math.ceil((60 * (index + 1)) / 10) + 2)
        state.columns.forEach((width, other) => {
          if (other !== column) expect(width).toBe(before.columns[other])
        })
      }
      const after = trail[trail.length - 1]
      expect(after.table).toBeGreaterThan(before.table)
      expect(problems).toEqual([])
    } finally {
      await app.close()
    }
  })
}

test('dragging past the edge of a narrow editor scrolls instead of squeezing the other columns', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await openTable(app, window, { windowWidth: 700 })
    const before = await measure(window)
    const trail = await dragBorder(window, 1, 400, 20)

    for (const state of trail) {
      expect(state.columns[0]).toBe(before.columns[0])
      expect(state.columns[2]).toBe(before.columns[2])
    }
    const after = trail[trail.length - 1]
    expect(after.scrolls).toBe(true)
    expect(after.table).toBeGreaterThan(after.wrapper)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a column cannot be dragged narrower than its minimum, and shrinking keeps the others still', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await openTable(app, window)
    const before = await measure(window)
    const trail = await dragBorder(window, 1, -400, 20)
    for (const state of trail) {
      expect(state.columns[1]).toBeGreaterThanOrEqual(70)
      expect(state.columns[0]).toBe(before.columns[0])
      expect(state.columns[2]).toBe(before.columns[2])
    }
    expect(trail[trail.length - 1].columns[1]).toBeLessThanOrEqual(74)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the hover handle is drawn equally thick on every row', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await openTable(app, window)
    const box = await window.locator(`${EDITOR} table tr:first-child > *`).nth(1).boundingBox()
    await window.mouse.move(box.x + box.width - 8, box.y + box.height / 2)
    await window.mouse.move(box.x + box.width - 1, box.y + box.height / 2)
    await expect(window.locator(`${EDITOR} .column-resize-handle`)).toHaveCount(3)

    const edges = await window.locator(`${EDITOR} .column-resize-handle`).evaluateAll(handles =>
      handles.map(handle => {
        const rect = handle.getBoundingClientRect()
        return { left: rect.left, width: rect.width }
      })
    )
    // Same left edge and width on every row, both whole pixels (no half-pixel blur).
    expect(new Set(edges.map(edge => edge.left)).size).toBe(1)
    expect(new Set(edges.map(edge => edge.width)).size).toBe(1)
    expect(Number.isInteger(edges[0].left)).toBe(true)
    expect(Number.isInteger(edges[0].width)).toBe(true)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a row added with Tab keeps the column widths', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await openTable(app, window)
    await dragBorder(window, 1, 40)
    const before = await measure(window)

    // Tab through all nine cells and out of the last one: it adds a fourth row.
    await window.locator(`${EDITOR} table th`).first().click()
    for (let i = 0; i < 9; i += 1) await window.keyboard.press('Tab')
    await expect(window.locator(`${EDITOR} table tr`)).toHaveCount(4)
    const after = await measure(window)
    expect(after.columns).toEqual(before.columns)
    expect(after.table).toBe(before.table)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a pasted Markdown table is resized the same way', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator(EDITOR).first().click()
    await window.evaluate(() => {
      const data = new DataTransfer()
      data.setData('text/plain', ['| 项目 | 数量 | 备注 |', '| --- | --- | --- |', '| 机油更换记录 | 2 | 在某某店更换完成 |', '| 滤芯 | 1 | 原厂 |'].join(String.fromCharCode(10)))
      document.querySelector('.sections-grid .ProseMirror')
        .dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await window.waitForSelector(`${EDITOR} table`)
    const before = await measure(window)
    const trail = await dragBorder(window, 1, 80)

    for (const state of trail) {
      expect(state.columns[0]).toBe(before.columns[0])
      expect(state.columns[2]).toBe(before.columns[2])
    }
    expect(trail[trail.length - 1].columns[1]).toBeGreaterThanOrEqual(before.columns[1] + 78)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
