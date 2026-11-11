import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// What every dialog owes the keyboard: focus goes in and comes back, Tab stays inside, Esc and the
// ✕ only ever mean "go back", and a text selection dragged out of a field is not a click outside.

async function openApp(sandbox, page = '日历') {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  if (page) await launched.window.locator('.nav-item', { hasText: page }).click()
  return launched
}

async function savedCountdowns(sandbox) {
  try {
    const meta = JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'metadata.json'), 'utf8'))
    return meta.countdowns || []
  } catch {
    return []
  }
}

const focusIsInside = (window, selector) => window.evaluate(
  sel => Boolean(document.querySelector(sel)?.contains(document.activeElement)),
  selector
)

function isoDate(daysFromToday) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

test('a dialog takes focus, keeps Tab inside, and Esc or the ✕ on the confirmation only go back', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    const opener = window.getByRole('button', { name: /倒数日/ })
    await opener.click()
    const modal = window.getByRole('dialog', { name: '倒数日管理' })
    await expect(modal).toBeVisible()
    // Focus is in the dialog, on the first field, not on the page behind it.
    await expect(modal.getByPlaceholder('名称（必填）')).toBeFocused()

    await modal.getByPlaceholder('名称（必填）').fill('生日')
    await modal.locator('input[type="date"]').fill(isoDate(5))
    await modal.getByRole('button', { name: '保存', exact: true }).click()

    const confirm = window.getByRole('alertdialog', { name: '保存确认' })
    await expect(confirm).toBeVisible()
    await expect(confirm.getByRole('button', { name: '添加并保存' })).toBeFocused()
    // Tab goes round the confirmation and never reaches the dialog or page under it.
    for (let step = 0; step < 6; step += 1) {
      await window.keyboard.press('Tab')
      expect(await focusIsInside(window, '[role="alertdialog"]')).toBe(true)
    }
    await window.keyboard.press('Shift+Tab')
    expect(await focusIsInside(window, '[role="alertdialog"]')).toBe(true)

    // Esc answers "not yet": the confirmation closes, the dialog and what was typed stay, nothing is saved.
    await window.keyboard.press('Escape')
    await expect(window.locator('[role="alertdialog"]')).toHaveCount(0)
    await expect(modal).toBeVisible()
    await expect(modal.getByPlaceholder('名称（必填）')).toHaveValue('生日')

    // The ✕ on the confirmation means the same, and a click outside it too.
    await modal.getByRole('button', { name: '保存', exact: true }).click()
    await window.getByRole('alertdialog').getByRole('button', { name: '关闭' }).click()
    await expect(window.locator('[role="alertdialog"]')).toHaveCount(0)
    await modal.getByRole('button', { name: '保存', exact: true }).click()
    await window.locator('.modal-overlay').last().click({ position: { x: 4, y: 4 } })
    await expect(window.locator('[role="alertdialog"]')).toHaveCount(0)
    await expect(modal).toBeVisible()
    await window.waitForTimeout(400)
    expect(await savedCountdowns(sandbox)).toEqual([])

    // Only the explicit button saves without the half-filled entry.
    await modal.getByRole('button', { name: '保存', exact: true }).click()
    await window.getByRole('alertdialog').getByRole('button', { name: '直接保存' }).click()
    await expect(window.locator('.modal')).toHaveCount(0)
    // Focus is back on the button that opened the dialog.
    await expect(opener).toBeFocused()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Esc closes a dialog from the keyboard, and Tab wraps around inside it', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.getByRole('button', { name: /倒数日/ }).click()
    const modal = window.getByRole('dialog', { name: '倒数日管理' })
    await expect(modal).toBeVisible()
    for (let step = 0; step < 14; step += 1) {
      await window.keyboard.press('Tab')
      expect(await focusIsInside(window, '[role="dialog"]')).toBe(true)
    }
    for (let step = 0; step < 14; step += 1) {
      await window.keyboard.press('Shift+Tab')
      expect(await focusIsInside(window, '[role="dialog"]')).toBe(true)
    }
    await window.keyboard.press('Escape')
    await expect(window.locator('.modal')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('dragging a text selection out of a field does not close the dialog, a click outside does', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.getByRole('button', { name: /倒数日/ }).click()
    const modal = window.locator('.modal')
    const input = modal.getByPlaceholder('名称（必填）')
    await input.fill('不要丢')
    const box = await input.boundingBox()
    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await window.mouse.down()
    await window.mouse.move(6, 6, { steps: 6 })
    await window.mouse.up()
    await expect(modal).toBeVisible()
    await expect(input).toHaveValue('不要丢')

    await window.locator('.modal-overlay').click({ position: { x: 6, y: 6 } })
    await expect(window.locator('.modal')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a long countdown list scrolls inside the dialog, which stays on screen with its buttons', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  const countdowns = Array.from({ length: 24 }, (_, index) => ({
    id: index + 1, name: `倒数${index + 1}`, date: isoDate(index + 1), color: '#34d399'
  }))
  await fs.writeFile(path.join(sandbox.dataDir, 'metadata.json'), JSON.stringify({ countdowns }))
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.getByRole('button', { name: /倒数日/ }).click()
    const modal = window.locator('.modal')
    await expect(modal.locator('.countdown-row')).toHaveCount(24)
    await expect.poll(async () => {
      const viewport = await window.evaluate(() => window.innerHeight)
      const dialog = await modal.boundingBox()
      const save = await modal.getByRole('button', { name: '保存', exact: true }).boundingBox()
      return dialog.y >= 0 && dialog.y + dialog.height <= viewport && save.y >= 0 && save.y + save.height <= viewport
    }).toBe(true)
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
