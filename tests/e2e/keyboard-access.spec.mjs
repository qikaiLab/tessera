import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// The clickable areas that are not <button>s must work from the keyboard: a day card in the
// timeline (open it, or tick it while managing), the date that opens the jump field, a section's
// name (rename). Toasts are announced to screen readers.

const pad = value => String(value).padStart(2, '0')
const doc = (text) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

function dayFile(sandbox, daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return path.join(sandbox.dataDir, String(date.getFullYear()), pad(date.getMonth() + 1), `${pad(date.getDate())}.json`)
}

async function seed(sandbox) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }
  ]))
  for (const [daysAgo, text] of [[1, '昨天的记录'], [2, '前天的记录']]) {
    const file = dayFile(sandbox, daysAgo)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify({ diary: { value: doc(text), updatedAt: new Date().toISOString() } }))
  }
}

async function openApp(sandbox, page) {
  await seed(sandbox)
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  if (page) await launched.window.locator('.nav-item', { hasText: page }).click()
  return launched
}

test('a timeline day opens with Enter, and is ticked with Space while managing', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox, '时间线')
  try {
    const cards = window.locator('.timeline-card')
    await expect(cards).toHaveCount(2)
    // The card is a button with a short name, reachable with Tab.
    await expect(cards.first()).toHaveAttribute('role', 'button')
    await expect(window.getByRole('button', { name: /，\d+ 字$/ })).toHaveCount(2)

    await window.getByRole('button', { name: /管理/ }).click()
    await expect(cards.first()).toHaveAttribute('role', 'checkbox')
    await cards.first().focus()
    await window.keyboard.press('Space')
    await expect(cards.first()).toHaveAttribute('aria-checked', 'true')
    await expect(cards.nth(1)).toHaveAttribute('aria-checked', 'false')
    await window.keyboard.press('Enter')
    await expect(cards.first()).toHaveAttribute('aria-checked', 'false')

    // Leaving the manage mode, Enter opens the day on the record page.
    await window.getByRole('button', { name: /完成|退出|取消/ }).first().click()
    await expect(cards.first()).toHaveAttribute('role', 'button')
    await cards.first().focus()
    await window.keyboard.press('Enter')
    await expect(window.locator('.nav-item.active')).toContainText('记录')
    await expect(window.locator('.today-date')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the date on the record page opens the jump field from the keyboard', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox, null)
  try {
    const date = window.locator('.today-date')
    await expect(date).toHaveAttribute('role', 'button')
    await expect(date).toHaveAttribute('aria-expanded', 'false')
    await date.focus()
    await window.keyboard.press('Enter')
    await expect(date).toHaveAttribute('aria-expanded', 'true')
    await expect(window.locator('.date-jump-form input[type="date"]')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a section is renamed from the keyboard, and the toast area announces errors', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox, '设置')
  try {
    await window.getByRole('tab', { name: '数据版块' }).click()
    const name = window.locator('.sec-item-name-editable').first()
    await expect(name).toHaveAttribute('role', 'button')
    await name.focus()
    await window.keyboard.press('Enter')
    const input = window.locator('.sec-item-name-input')
    await expect(input).toBeFocused()
    await input.fill('随手记')
    await window.keyboard.press('Enter')
    await expect(window.locator('.sec-item-name-editable').first()).toContainText('随手记')

    const toasts = window.locator('.toast-container')
    await expect(toasts).toHaveAttribute('role', 'status')
    await expect(toasts).toHaveAttribute('aria-live', 'polite')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
