import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

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
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
    { id: 'steps', name: '步数', type: 'number', unit: '步', resident: false, order: 1 }
  ]))
  const entry = value => ({ value, updatedAt: new Date().toISOString() })
  const days = [
    [1, { diary: entry(doc('只有日记的一天')) }],
    [2, { diary: entry(doc('日记和步数都有')), steps: entry('8000') }],
    [3, { steps: entry('5000') }]
  ]
  for (const [daysAgo, data] of days) {
    const file = dayFile(sandbox, daysAgo)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(data))
  }
}

async function openTimeline(sandbox) {
  await seed(sandbox)
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '时间线' }).click()
  await expect(launched.window.locator('.timeline-card')).toHaveCount(3)
  return launched
}

async function readDay(sandbox, daysAgo) {
  try {
    return JSON.parse(await fs.readFile(dayFile(sandbox, daysAgo), 'utf8'))
  } catch {
    return null
  }
}

test('clearing one section from days in the timeline keeps the other sections, numbers included', async ({ sandbox }) => {
  const { app, window, problems } = await openTimeline(sandbox)
  try {
    await window.getByRole('button', { name: /管理/ }).click()
    await window.getByRole('button', { name: '筛选版块' }).click()
    await window.getByRole('option', { name: /日记/ }).click()
    await window.keyboard.press('Escape')
    // Only days that have a diary remain; select both of them.
    await expect(window.locator('.timeline-card')).toHaveCount(2)
    await window.getByRole('button', { name: '全选' }).click()
    await expect(window.locator('.selected-count')).toHaveText('2')

    await window.getByRole('button', { name: /批量删除/ }).click()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('日记')
    await dialog.getByRole('button', { name: '确定清除' }).click()
    await expect(window.getByText(/成功清除 2 天/)).toBeVisible()

    // The diary-only day is gone; the day that also had steps keeps its number; the untouched
    // day is as it was.
    await expect.poll(() => readDay(sandbox, 1)).toBeNull()
    await expect.poll(async () => Object.keys((await readDay(sandbox, 2)) || {})).toEqual(['steps'])
    expect((await readDay(sandbox, 2)).steps.value).toBe('8000')
    expect((await readDay(sandbox, 3)).steps.value).toBe('5000')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('deleting whole days from the timeline removes their files', async ({ sandbox }) => {
  const { app, window, problems } = await openTimeline(sandbox)
  try {
    await window.getByRole('button', { name: /管理/ }).click()
    await window.locator('.timeline-card').first().click()
    await expect(window.locator('.selected-count')).toHaveText('1')
    await window.getByRole('button', { name: /批量删除/ }).click()
    await window.locator('.modal').getByRole('button', { name: '确定删除' }).click()
    await expect(window.locator('.timeline-card')).toHaveCount(2)
    // The newest day (one day ago) was the first card.
    await expect.poll(() => readDay(sandbox, 1)).toBeNull()
    expect(await readDay(sandbox, 2)).not.toBeNull()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
