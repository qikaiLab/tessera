import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// What every dialog owes the keyboard: focus goes in and comes back, Tab stays inside, Esc and the
// ✕ only ever mean "go back", and a text selection dragged out of a dialog is not a click outside.

async function openApp(sandbox, page) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  if (page) await launched.window.locator('.nav-item', { hasText: page }).click()
  return launched
}

const focusIsInside = (window, selector) => window.evaluate(
  sel => Boolean(document.querySelector(sel)?.contains(document.activeElement)),
  selector
)

const chart = (id, title) => ({
  id, title, type: 'bar', bindings: [], dateRange: '30', dateAxisMode: 'recorded', lineStyle: 'smooth', dateFrom: '', dateTo: ''
})

// The analytics page with two charts, whose delete confirmation is the dialog these tests work on.
async function openAnalyticsWithCharts(sandbox) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(
    path.join(sandbox.dataDir, 'metadata.json'),
    JSON.stringify({ countdowns: [], analytics: [chart('a', '图表甲'), chart('b', '图表乙')] })
  )
  const launched = await openApp(sandbox, '数据分析')
  await expect(launched.window.locator('.analytics-card')).toHaveCount(2)
  return launched
}

test('a confirmation takes focus, keeps Tab inside, and Esc, the ✕ or a click outside only go back', async ({ sandbox }) => {
  const { app, window, problems } = await openAnalyticsWithCharts(sandbox)
  try {
    const askToDelete = async () => {
      await window.locator('.analytics-card').first().click({ button: 'right' })
      await window.getByRole('menuitem', { name: '删除' }).click()
      const confirm = window.getByRole('alertdialog', { name: '删除图表' })
      await expect(confirm).toBeVisible()
      return confirm
    }

    let confirm = await askToDelete()
    // Focus is in the dialog, on the safe answer, not on the page behind it.
    await expect(confirm.getByRole('button', { name: '取消' })).toBeFocused()
    // Tab goes round the confirmation and never reaches the page under it.
    for (let step = 0; step < 6; step += 1) {
      await window.keyboard.press('Tab')
      expect(await focusIsInside(window, '[role="alertdialog"]')).toBe(true)
    }
    await window.keyboard.press('Shift+Tab')
    expect(await focusIsInside(window, '[role="alertdialog"]')).toBe(true)

    // Esc answers "not yet": the confirmation closes and the chart stays.
    await window.keyboard.press('Escape')
    await expect(window.locator('[role="alertdialog"]')).toHaveCount(0)
    await expect(window.locator('.analytics-card')).toHaveCount(2)

    // The ✕ means the same, and so does a click outside the box.
    confirm = await askToDelete()
    await confirm.getByRole('button', { name: '关闭' }).click()
    await expect(window.locator('[role="alertdialog"]')).toHaveCount(0)
    confirm = await askToDelete()
    await window.locator('.modal-overlay').last().click({ position: { x: 4, y: 4 } })
    await expect(window.locator('[role="alertdialog"]')).toHaveCount(0)
    await window.waitForTimeout(400)
    await expect(window.locator('.analytics-card')).toHaveCount(2)

    // Only the explicit button deletes.
    confirm = await askToDelete()
    await confirm.getByRole('button', { name: '确定删除' }).click()
    await expect(window.locator('.analytics-card')).toHaveCount(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Esc closes a dialog from the keyboard, and Tab wraps around inside it', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox, null)
  try {
    await window.getByTitle('使用说明').click()
    const dialog = window.getByRole('dialog', { name: '使用说明' })
    await expect(dialog).toBeVisible()
    for (let step = 0; step < 14; step += 1) {
      await window.keyboard.press('Tab')
      expect(await focusIsInside(window, '[role="dialog"]')).toBe(true)
    }
    for (let step = 0; step < 14; step += 1) {
      await window.keyboard.press('Shift+Tab')
      expect(await focusIsInside(window, '[role="dialog"]')).toBe(true)
    }
    await window.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('dragging a text selection out of a dialog does not close it, a click outside does', async ({ sandbox }) => {
  const { app, window, problems } = await openAnalyticsWithCharts(sandbox)
  try {
    await window.locator('.analytics-card').first().click({ button: 'right' })
    await window.getByRole('menuitem', { name: '删除' }).click()
    const dialog = window.getByRole('alertdialog', { name: '删除图表' })
    await expect(dialog).toBeVisible()

    // Pressed on the dialog's own text and let go out over the dimmed overlay: not a click on it.
    const box = await dialog.getByText('确定要删除图表').boundingBox()
    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await window.mouse.down()
    await window.mouse.move(6, 6, { steps: 6 })
    await window.mouse.up()
    await expect(dialog).toBeVisible()

    await window.locator('.modal-overlay').click({ position: { x: 6, y: 6 } })
    await expect(window.locator('[role="alertdialog"]')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Esc closes the shortcut list or the right-click menu without also leaving the fullscreen editor', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox, null)
  try {
    await window.waitForTimeout(600)
    await window.locator('.fullscreen-btn').first().click()
    const shell = window.locator('.tiptap-shell.tiptap-fullscreen')
    await expect(shell).toBeVisible()

    await window.keyboard.press('Control+/')
    await expect(window.locator('.shortcuts-modal')).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(window.locator('.shortcuts-modal')).toHaveCount(0)
    await expect(shell).toBeVisible()

    await shell.locator('.ProseMirror').click({ button: 'right' })
    await expect(window.locator('.app-context-menu')).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(window.locator('.app-context-menu')).toHaveCount(0)
    await expect(shell).toBeVisible()

    // With nothing else open, Esc leaves fullscreen as before.
    await shell.locator('.ProseMirror').click()
    await window.keyboard.press('Escape')
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
