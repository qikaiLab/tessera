import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

function todayFile(sandbox) {
  const now = new Date()
  return path.join(sandbox.dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(now.getDate())}.json`)
}

async function readToday(sandbox) {
  try {
    return JSON.parse(await fs.readFile(todayFile(sandbox), 'utf8'))
  } catch {
    return null
  }
}

async function seedSections(sandbox, sections) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify(sections))
}

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.waitForTimeout(600)
  return launched
}

const text = (id, name, order, resident) => ({ id, name, type: 'text', unit: '', resident, order })
const number = (id, name, order, resident = false) => ({ id, name, type: 'number', unit: '次', resident, order })

test('adding a number section stores nothing until a value is entered', async ({ sandbox }) => {
  await seedSections(sandbox, [text('diary', '日记', 0, true), number('count', '计数', 1)])
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.getByRole('button', { name: '+ 计数' }).click()
    await expect(window.locator('[data-section-slot="count"]')).toBeVisible()
    // Wait well past the save debounce: adding alone must not write a default 0 to the day.
    await window.waitForTimeout(1600)
    expect(await readToday(sandbox)).toBeNull()

    // Come back to the day: the section is not activated any more.
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(window.locator('[data-section-slot="count"]')).toHaveCount(0)
    await expect(window.getByRole('button', { name: '+ 计数' })).toBeVisible()

    // Entering a value is what activates it, and that sticks.
    await window.getByRole('button', { name: '+ 计数' }).click()
    await window.locator('[data-section-slot="count"] .num-btn', { hasText: '+' }).click()
    await expect.poll(async () => (await readToday(sandbox))?.count?.value).toBe('1')
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(window.locator('[data-section-slot="count"]')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('an empty activated section closes from its tag, and the cards below glide', async ({ sandbox }) => {
  await seedSections(sandbox, [
    text('diary', '日记', 0, true),
    text('mid', '中间板块', 1, false),
    text('tail', '尾部板块', 2, true)
  ])
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.evaluate(() => {
      window.__track = (ms) => new Promise(resolve => {
        const rows = []
        const start = performance.now()
        const frame = now => {
          const tail = document.querySelector('[data-section-slot="tail"]')
          rows.push(Math.round(tail.getBoundingClientRect().top))
          if (now - start < ms) requestAnimationFrame(frame)
          else resolve(rows)
        }
        requestAnimationFrame(frame)
      })
    })
    const tailTop = () => window.locator('[data-section-slot="tail"]').evaluate(el => Math.round(el.getBoundingClientRect().top))
    const before = await tailTop()

    // Adding in the middle: the card below starts exactly where it was and moves down smoothly.
    await window.evaluate(() => { window.__run = window.__track(900) })
    await window.getByRole('button', { name: '+ 中间板块' }).click()
    const growing = await window.evaluate(() => window.__run)
    const added = await tailTop()
    expect(added).toBeGreaterThan(before + 60)
    expect(Math.abs(growing[0] - before)).toBeLessThanOrEqual(8)
    expect(growing.every((value, index) => index === 0 || value >= growing[index - 1] - 1)).toBe(true)

    // Empty and optional: the tag offers to close it.
    const tag = window.locator('[data-section-slot="mid"] button.section-type-badge.is-closable')
    await expect(tag).toBeVisible()

    // Closing folds it away; the card below starts where it was and glides back up.
    await window.evaluate(() => { window.__run = window.__track(900) })
    await tag.click()
    await expect(window.locator('[data-section-slot="mid"].is-removing')).toHaveCount(1)
    const shrinking = await window.evaluate(() => window.__run)
    await expect(window.locator('[data-section-slot="mid"]')).toHaveCount(0)
    expect(Math.abs(shrinking[0] - added)).toBeLessThanOrEqual(8)
    expect(shrinking.every((value, index) => index === 0 || value <= shrinking[index - 1] + 1)).toBe(true)
    expect(Math.abs(await tailTop() - before)).toBeLessThanOrEqual(2)
    await expect(window.getByRole('button', { name: '+ 中间板块' })).toBeVisible()

    // With something written the tag is just a tag again.
    await window.getByRole('button', { name: '+ 中间板块' }).click()
    const editor = window.locator('[data-section-slot="mid"] .ProseMirror')
    await expect(editor).toBeFocused()
    await window.keyboard.type('一点内容')
    await expect(window.locator('[data-section-slot="mid"] button.section-type-badge.is-closable')).toHaveCount(0)
    await expect(window.locator('[data-section-slot="mid"] span.section-type-badge.activated')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('clearing an activated section asks first, then folds away', async ({ sandbox }) => {
  await seedSections(sandbox, [text('diary', '日记', 0, true), text('extra', '额外记录', 1, false)])
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.getByRole('button', { name: '+ 额外记录' }).click()
    const slot = window.locator('[data-section-slot="extra"]')
    await expect(slot.locator('.ProseMirror')).toBeFocused()
    await window.keyboard.type('不能丢的一大段内容')
    await expect.poll(async () => Boolean((await readToday(sandbox))?.extra)).toBe(true)

    const clearFromMenu = async () => {
      await slot.locator('.section-card-title').click({ button: 'right' })
      await window.getByRole('menuitem', { name: '清空并关闭板块' }).click()
    }

    // Declining keeps everything.
    await clearFromMenu()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('确定要清空')
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(slot).toBeVisible()
    await expect(slot).not.toHaveClass(/is-removing/)
    expect((await readToday(sandbox))?.extra).toBeTruthy()

    // Confirming clears the data at once and the card folds away instead of vanishing.
    await clearFromMenu()
    await dialog.getByRole('button', { name: '清空', exact: true }).click()
    await expect(slot).toHaveClass(/is-removing/)
    // While leaving, it still shows what it held.
    await expect(slot).toContainText('不能丢的一大段内容')
    await expect(slot).toHaveCount(0)
    await expect.poll(async () => (await readToday(sandbox))?.extra).toBeUndefined()
    await expect(window.getByRole('button', { name: '+ 额外记录' })).toBeVisible()

    // An empty activated section needs no confirmation at all.
    await window.getByRole('button', { name: '+ 额外记录' }).click()
    await expect(slot).toBeVisible()
    await slot.locator('.section-card-title').click({ button: 'right' })
    await window.getByRole('menuitem', { name: '关闭板块' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(slot).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
