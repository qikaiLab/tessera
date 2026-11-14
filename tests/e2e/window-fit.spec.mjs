import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// A laptop screen or a high display scaling leaves the app much less room than its preferred
// 1280x800 (a 1366x768 display at 125% offers about 1093x574 of usable area, a 1920x1080 display at
// 150% about 1280x680). The window must fit that area, and every page must stay usable in it, also
// with the interface zoomed to 150% (which shrinks the page to roughly 600x370 CSS pixels).
// The test pretends the usable area is 960x560: small enough to be below every display a runner
// may have (a CI machine offers about 1024x720, and Windows itself keeps a window inside the real
// work area), yet below the preferred size in both directions.
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
  const { app, window, problems } = await launchApp(sandbox, { env: { TESSERA_E2E_WORK_AREA: '960x560' } })
  try {
    const bounds = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return { size: win.getSize(), min: win.getMinimumSize() }
    })
    expect(bounds.size).toEqual([960, 560])
    expect(bounds.min).toEqual([900, 560])

    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')

    // The smallest window at the largest zoom.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 560))
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

test('without a work area override the window keeps its preferred size, as far as the real screen allows', async ({ sandbox }) => {
  const { app, window } = await launchApp(sandbox)
  try {
    const { size, available } = await app.evaluate(({ BrowserWindow, screen }) => ({
      size: BrowserWindow.getAllWindows()[0].getSize(),
      available: screen.getPrimaryDisplay().workAreaSize
    }))
    // Windows never opens a window larger than the display's work area, so on a small runner the
    // preferred 1280x800 is cut to it; on a large screen it is kept whole.
    expect(size).toEqual([Math.min(1280, available.width), Math.min(800, available.height)])
    await expect(window.locator('.sidebar')).toBeVisible()
  } finally {
    await app.close()
  }
})
