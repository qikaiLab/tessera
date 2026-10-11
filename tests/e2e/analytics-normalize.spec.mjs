import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

test('normalizing a multi-series chart gives every series a shared 0-100% axis', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'run', name: '跑步', type: 'number', unit: 'm', resident: false, order: 0 },
    { id: 'sleep', name: '睡眠', type: 'number', unit: 'h', resident: false, order: 1 },
    { id: 'mood', name: '心情', type: 'number', unit: '', resident: false, order: 2 }
  ]))
  for (let daysAgo = 1; daysAgo <= 6; daysAgo += 1) {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    const file = path.join(sandbox.dataDir, String(date.getFullYear()), pad(date.getMonth() + 1), `${pad(date.getDate())}.json`)
    await fs.mkdir(path.dirname(file), { recursive: true })
    const entry = value => ({ value: String(value), updatedAt: new Date().toISOString() })
    await fs.writeFile(file, JSON.stringify({ run: entry(daysAgo * 1000), sleep: entry(5 + daysAgo / 2), mood: entry(daysAgo % 5 + 1) }))
  }
  await fs.writeFile(path.join(sandbox.dataDir, 'metadata.json'), JSON.stringify({
    countdowns: [],
    analytics: [{
      id: 'c1',
      title: '三项对比',
      type: 'line',
      dateRange: '30',
      dateAxisMode: 'recorded',
      lineStyle: 'smooth',
      dateFrom: '',
      dateTo: '',
      bindings: [
        { sectionId: 'run', metric: 'value' },
        { sectionId: 'sleep', metric: 'value' },
        { sectionId: 'mood', metric: 'value' }
      ]
    }]
  }))

  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '数据分析' }).click()

    const card = window.locator('.analytics-card').first()
    await expect(card.locator('.recharts-line')).toHaveCount(3)
    // Three raw series share one axis without ticks, and the editor explains why.
    await expect(card.locator('.recharts-yAxis')).toHaveCount(0)
    await card.getByTitle('配置').click()
    await expect(card.getByText(/可在下方将纵轴改为「归一化」/)).toBeVisible()

    await card.getByRole('radio', { name: /归一化/ }).click()
    await expect(card.locator('.recharts-yAxis')).toContainText('100%')
    await expect(card.getByText(/只比较走势/)).toBeVisible()

    // The choice is stored on the card and survives a type switch and back.
    await card.getByRole('radio', { name: '柱状图' }).click()
    await expect(card.locator('.recharts-yAxis')).toContainText('100%')
    await card.getByRole('radio', { name: '原始数值' }).click()
    await expect(card.locator('.recharts-yAxis')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
