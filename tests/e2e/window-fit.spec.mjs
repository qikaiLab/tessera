import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// A laptop screen or a high display scaling leaves the app much less room than its preferred
// 1280x800 (a 1366x768 display at 125% offers about 1093x574 of usable area, a 1920x1080 display at
// 150% about 1280x680). The window must fit that area, and every page must stay usable in it, also
// with the interface zoomed to 150% (which shrinks the page to roughly 600x370 CSS pixels).
const PAGES = ['记录', '便签', '日历', '时间线', '数据分析', '设置']

async function writeSomeData(sandbox) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
    { id: 'weight', name: '体重', type: 'number', unit: 'kg', resident: true, order: 1 }
  ]))
}

test('the window fits a small work area and every page stays usable at 150% zoom', async ({ sandbox }) => {
  await writeSomeData(sandbox)
  const { app, window, problems } = await launchApp(sandbox, { env: { TESSERA_E2E_WORK_AREA: '1093x574' } })
  try {
    const bounds = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return { size: win.getSize(), min: win.getMinimumSize() }
    })
    expect(bounds.size).toEqual([1093, 574])
    expect(bounds.min).toEqual([900, 574])

    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')

    // The smallest window at the largest zoom.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 574))
    for (const zoom of [100, 150]) {
      await window.evaluate(value => window.api.zoom.setFactor(value / 100), zoom)
      for (const page of PAGES) {
        await window.locator('.nav-item', { hasText: page }).click()
        await window.waitForTimeout(450)
        const overflow = await window.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth
        }))
        expect(overflow.page, `${page} at ${zoom}% scrolls sideways`).toBeLessThanOrEqual(1)
        expect(overflow.body, `${page} at ${zoom}% scrolls sideways`).toBeLessThanOrEqual(1)
      }
    }
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('without a work area override the window keeps its preferred size', async ({ sandbox }) => {
  const { app, window } = await launchApp(sandbox)
  try {
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getSize())).toEqual([1280, 800])
    await expect(window.locator('.sidebar')).toBeVisible()
  } finally {
    await app.close()
  }
})
