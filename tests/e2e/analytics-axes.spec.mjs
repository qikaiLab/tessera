import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

const sections = [
  { id: 'run', name: '跑步', type: 'number', unit: 'm', resident: false, order: 0, color: '#ff6633' },
  { id: 'sleep', name: '睡眠', type: 'number', unit: 'h', resident: false, order: 1, color: '#3366ff' },
  { id: 'mood', name: '心情', type: 'number', unit: '', resident: false, order: 2 },
  { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 3 }
]

const bind = (...ids) => ids.map(sectionId => ({ sectionId, metric: sectionId === 'diary' ? 'wordcount' : 'value' }))
const chart = (id, title, type, bindings, extra = {}) => ({
  id, title, type, bindings, dateRange: '30', dateAxisMode: 'recorded', lineStyle: 'smooth', dateFrom: '', dateTo: '', ...extra
})

test('chart cards draw the axes and series their bindings call for', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify(sections))
  for (let daysAgo = 1; daysAgo <= 5; daysAgo += 1) {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    const file = path.join(sandbox.dataDir, String(date.getFullYear()), pad(date.getMonth() + 1), `${pad(date.getDate())}.json`)
    await fs.mkdir(path.dirname(file), { recursive: true })
    const entry = value => ({ value: String(value), updatedAt: new Date().toISOString() })
    const text = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '写了一些字'.repeat(daysAgo) }] }] })
    await fs.writeFile(file, JSON.stringify({ run: entry(daysAgo * 1000), sleep: entry(5 + daysAgo), mood: entry(daysAgo), diary: entry(text) }))
  }
  await fs.writeFile(path.join(sandbox.dataDir, 'metadata.json'), JSON.stringify({
    countdowns: [],
    analytics: [
      chart('one', '单序列折线', 'line', bind('run')),
      chart('two', '双序列柱状', 'bar', bind('run', 'sleep')),
      chart('three', '三序列折线', 'line', bind('run', 'sleep', 'mood')),
      chart('words', '字数', 'bar', bind('diary')),
      chart('slices', '饼图', 'pie', bind('run', 'sleep')),
      chart('heat', '热力图', 'heatmap', bind('run'), { dateRange: '30' })
    ]
  }))

  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '数据分析' }).click()
    const card = (title) => window.locator('.analytics-card', { has: window.locator(`input[value="${title}"]`) })

    // One series: a single left axis.
    await expect(card('单序列折线').locator('.recharts-line')).toHaveCount(1)
    await expect(card('单序列折线').locator('.recharts-yAxis')).toHaveCount(1)

    // Two series: a left and a right axis, and a legend naming both.
    await expect(card('双序列柱状').locator('.recharts-bar')).toHaveCount(2)
    await expect(card('双序列柱状').locator('.recharts-yAxis')).toHaveCount(2)
    await expect(card('双序列柱状').locator('.recharts-legend-item')).toHaveCount(2)

    // Three series: no axis, only the legend.
    await expect(card('三序列折线').locator('.recharts-line')).toHaveCount(3)
    await expect(card('三序列折线').locator('.recharts-yAxis')).toHaveCount(0)
    await expect(card('三序列折线').locator('.recharts-legend-item')).toHaveCount(3)

    // A text section charts its character count.
    await expect(card('字数').locator('.recharts-bar')).toHaveCount(1)
    await expect(card('字数').locator('.recharts-yAxis')).toHaveCount(1)

    // A pie shows a slice per bound section, and a heatmap a grid of day cells.
    await expect(card('饼图').locator('.recharts-pie-sector')).toHaveCount(2)
    // (Cells that only fill out the first week are hidden spaces, not days.)
    const dayCells = card('热力图').locator('.heatmap-cell:not([aria-hidden="true"])')
    await expect(dayCells.first()).toBeVisible()
    expect(await dayCells.count()).toBeGreaterThanOrEqual(30)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
