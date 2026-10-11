import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const card = (id, title) => ({
  id,
  title,
  type: 'bar',
  bindings: [],
  dateRange: '30',
  dateAxisMode: 'recorded',
  lineStyle: 'smooth',
  dateFrom: '',
  dateTo: ''
})

async function openAnalytics(sandbox) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(
    path.join(sandbox.dataDir, 'metadata.json'),
    JSON.stringify({ countdowns: [], analytics: [card('a', '图表甲'), card('b', '图表乙')] })
  )
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '数据分析' }).click()
  await expect(launched.window.locator('.analytics-card')).toHaveCount(2)
  return launched
}

test('clicking a chart drag handle does not crash the window', async ({ sandbox }) => {
  const { app, window, problems } = await openAnalytics(sandbox)
  try {
    const handle = window.locator('.analytics-drag-handle').first()
    await handle.click()
    await handle.click()
    // The whole UI (title bar, sidebar, both charts) is still there and nothing threw.
    await expect(window.locator('.sidebar')).toBeVisible()
    await expect(window.locator('.titlebar')).toBeVisible()
    await expect(window.locator('.analytics-card')).toHaveCount(2)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('dragging a chart handle reorders the charts, and a drop outside is harmless', async ({ sandbox }) => {
  const { app, window, problems } = await openAnalytics(sandbox)
  try {
    const titles = () => window.locator('.analytics-card-title').evaluateAll(inputs => inputs.map(input => input.value))
    expect(await titles()).toEqual(['图表甲', '图表乙'])

    const mouse = window.mouse
    const drag = async (from, to) => {
      const start = await from.boundingBox()
      const end = to ? await to.boundingBox() : null
      await mouse.move(start.x + start.width / 2, start.y + start.height / 2)
      await mouse.down()
      const targetX = end ? end.x + end.width / 2 : 5
      const targetY = end ? end.y + end.height / 2 : 5
      await mouse.move(targetX, targetY, { steps: 12 })
      await mouse.up()
    }

    // Dropped far outside every card: no reorder and no crash.
    await drag(window.locator('.analytics-drag-handle').first(), null)
    await expect(window.locator('.sidebar')).toBeVisible()
    expect(await titles()).toEqual(['图表甲', '图表乙'])

    await drag(window.locator('.analytics-drag-handle').first(), window.locator('.analytics-card').nth(1))
    await expect.poll(titles).toEqual(['图表乙', '图表甲'])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
