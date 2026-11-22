import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

test('a calendar day that holds records reacts to the pointer like any other day', async ({ sandbox }) => {
  // A day of the current month that is not today (today and the selected day keep their own look).
  const now = new Date()
  const day = now.getDate() === 1 ? 2 : 1
  const file = path.join(sandbox.dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(day)}.json`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ steps: { value: '8000', updatedAt: now.toISOString() } }))
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'steps', name: '步数', type: 'number', unit: '步', resident: true, order: 0 }
  ]))

  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '日历' }).click()
    await expect(window.locator('.month-grid')).toBeVisible()

    const card = window.locator('.cal-day.has-data:not(.other-month):not(.today):not(.selected)').first()
    await expect(card).toBeVisible()
    // Let the entrance animation finish before reading colours.
    await window.waitForTimeout(900)
    const background = () => card.evaluate(el => getComputedStyle(el).backgroundColor)
    const resting = await background()

    await card.hover()
    await expect.poll(background).not.toBe(resting)

    await window.mouse.move(0, 0)
    await expect.poll(background).toBe(resting)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
