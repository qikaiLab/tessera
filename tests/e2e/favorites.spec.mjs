import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

async function start(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

const readFavorites = async sandbox => {
  try {
    const metadata = JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'metadata.json'), 'utf8'))
    return metadata.favorites ?? []
  } catch {
    return []
  }
}

test('favorites a record card and finds it again from the timeline', async ({ sandbox }) => {
  const entry = `值得回看的内容 ${Date.now()}`
  const first = await start(sandbox)
  try {
    const { window, problems } = first
    const card = window.locator('.section-card').first()
    const star = card.getByRole('button', { name: /收藏日记/ })

    // An empty card cannot be favorited.
    await star.click()
    await expect(star).toHaveAttribute('aria-pressed', 'false')

    await window.locator('.sections-grid .ProseMirror').first().click()
    await window.keyboard.type(entry)
    await star.click()
    await expect(card.getByRole('button', { name: /取消收藏日记/ })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await readFavorites(sandbox)).length, { timeout: 15_000 }).toBe(1)

    await window.locator('.nav-item', { hasText: '时间线' }).click()
    await expect(window.locator('.timeline-card')).toHaveCount(1)
    await window.getByRole('button', { name: /收藏/ }).first().click()
    await expect(window.locator('.timeline-card')).toHaveCount(1)
    await expect(window.locator('.tl-snippet-text').first()).toContainText(entry)
    expect(problems).toEqual([])
  } finally {
    await first.app.close()
  }

  // Favorites live in metadata.json, so they survive a restart.
  const second = await start(sandbox)
  try {
    const { window } = second
    await window.locator('.nav-item', { hasText: '时间线' }).click()
    await window.getByRole('button', { name: /收藏/ }).first().click()
    await expect(window.locator('.timeline-card')).toHaveCount(1)

    await window.getByRole('button', { name: /取消收藏日记/ }).click()
    await expect(window.locator('.timeline-card')).toHaveCount(0)
    await expect(window.getByText('还没有符合条件的收藏')).toBeVisible()
    await expect.poll(async () => (await readFavorites(sandbox)).length, { timeout: 15_000 }).toBe(0)
  } finally {
    await second.app.close()
  }
})
