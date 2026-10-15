import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

async function openCalendar(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '日历' }).click()
  await expect(launched.window.locator('.cal-slide')).toBeVisible()
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

function isoDate(daysFromToday) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

test('countdowns are added in the modal, listed under the calendar and saved to disk', async ({ sandbox }) => {
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    await window.getByRole('button', { name: /倒数日/ }).click()
    const modal = window.locator('.modal')
    await expect(modal).toContainText('还没有倒数日')

    // The add button insists on both a name and a date.
    await modal.getByRole('button', { name: '添加', exact: true }).click()
    await expect(modal).toContainText('请填写名称和日期')
    await modal.getByPlaceholder('名称（必填）').fill('考试')
    await modal.getByRole('button', { name: '添加', exact: true }).click()
    await expect(modal).toContainText('请选择目标日期')

    await modal.locator('input[type="date"]').fill(isoDate(10))
    await modal.getByRole('button', { name: '添加', exact: true }).click()
    await expect(modal.locator('.countdown-row')).toHaveCount(1)
    await expect(modal.locator('.cd-diff')).toHaveText('还有 10 天')

    await modal.getByRole('button', { name: '保存', exact: true }).click()
    await expect(modal).toHaveCount(0)
    await expect(window.locator('.countdown-legend .countdown-item')).toHaveCount(1)
    await expect(window.locator('.countdown-legend')).toContainText('考试')
    await expect(window.locator('.countdown-legend')).toContainText('还有 10 天')
    await expect.poll(async () => (await savedCountdowns(sandbox)).map(item => item.name)).toEqual(['考试'])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('closing or cancelling the modal discards edits, and removing a countdown only counts once saved', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'metadata.json'), JSON.stringify({
    countdowns: [
      { id: 1, name: '旅行', date: isoDate(0), color: '#34d399' },
      { id: 2, name: '截止', date: isoDate(-3), color: '#f87171' }
    ]
  }))
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    const legend = window.locator('.countdown-legend .countdown-item')
    await expect(legend).toHaveCount(2)
    await expect(legend.nth(0)).toContainText('今天！')
    await expect(legend.nth(1)).toContainText('已过 3 天')

    await window.getByRole('button', { name: /倒数日/ }).click()
    const modal = window.locator('.modal')
    await modal.locator('.countdown-row').first().getByRole('button').click()
    await expect(modal.locator('.countdown-row')).toHaveCount(1)
    await modal.getByRole('button', { name: '取消' }).click()
    await expect(modal).toHaveCount(0)
    await expect(legend).toHaveCount(2)

    await window.getByRole('button', { name: /倒数日/ }).click()
    await expect(modal.locator('.countdown-row')).toHaveCount(2)
    await modal.locator('.countdown-row').first().getByRole('button').click()
    await modal.getByRole('button', { name: '保存', exact: true }).click()
    await expect(legend).toHaveCount(1)
    await expect.poll(async () => (await savedCountdowns(sandbox)).map(item => item.name)).toEqual(['截止'])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('saving with a half-filled add form asks whether to add it first', async ({ sandbox }) => {
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    await window.getByRole('button', { name: /倒数日/ }).click()
    const modal = window.locator('.modal').first()
    await modal.getByPlaceholder('名称（必填）').fill('生日')
    await modal.locator('input[type="date"]').fill(isoDate(5))
    await modal.getByRole('button', { name: '保存', exact: true }).click()

    const confirm = window.locator('.modal').last()
    await expect(confirm).toContainText('是否先将其添加再保存')
    await confirm.getByRole('button', { name: '添加并保存' }).click()
    await expect(window.locator('.countdown-legend')).toContainText('生日')
    await expect.poll(async () => (await savedCountdowns(sandbox)).map(item => item.name)).toEqual(['生日'])

    // Only a name typed: choosing "添加并保存" cannot add it, so the modal stays and asks for the date.
    await window.getByRole('button', { name: /倒数日/ }).click()
    const reopened = window.locator('.modal').first()
    await reopened.getByPlaceholder('名称（必填）').fill('半截')
    await reopened.getByRole('button', { name: '保存', exact: true }).click()
    await window.locator('.modal').last().getByRole('button', { name: '添加并保存' }).click()
    await expect(reopened).toContainText('请选择目标日期')
    await expect(window.locator('.countdown-legend .countdown-item')).toHaveCount(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
