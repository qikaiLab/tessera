import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

async function writeHistory(sandbox, days) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }
  ]))
  for (let daysAgo = 1; daysAgo <= days; daysAgo += 1) {
    const date = new Date(2026, 0, 1)
    date.setDate(date.getDate() - daysAgo)
    const file = path.join(sandbox.dataDir, String(date.getFullYear()), pad(date.getMonth() + 1), `${pad(date.getDate())}.json`)
    await fs.mkdir(path.dirname(file), { recursive: true })
    const text = daysAgo % 25 === 0 ? `特别的一天 ${daysAgo}` : `普通记录 ${daysAgo}`
    await fs.writeFile(file, JSON.stringify({
      diary: {
        value: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }),
        updatedAt: new Date().toISOString()
      }
    }))
  }
}

test('a long history is rendered in batches and still filterable', async ({ sandbox }) => {
  await writeHistory(sandbox, 130)
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '时间线' }).click()

    const cards = window.locator('.timeline-card')
    await expect(cards.first()).toBeVisible()
    await expect(window.locator('.stat-item')).toContainText('130')
    // Only the first batch is in the DOM.
    await expect(cards).toHaveCount(40)

    // More arrive as the list is scrolled (or on request).
    await window.locator('.timeline-list').evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect.poll(() => cards.count()).toBeGreaterThan(40)
    await window.getByRole('button', { name: /显示更多/ }).click().catch(() => {})

    // Searching still looks at every day, not just the rendered ones.
    await window.getByPlaceholder('搜索记录内容...').fill('特别的一天')
    await expect(cards).toHaveCount(5)

    // Management mode selects every matching day, rendered or not.
    await window.getByPlaceholder('搜索记录内容...').fill('')
    await window.getByRole('button', { name: /管理/ }).click()
    await window.getByRole('button', { name: '全选' }).click()
    await expect(window.locator('.selected-count')).toHaveText('130')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
