import { test, expect, launchApp } from './fixtures.mjs'

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

test('F1 opens the guide and Ctrl+/ toggles the shortcut list', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await expect(window.locator('.onboarding-modal')).toHaveCount(0)
    await window.keyboard.press('F1')
    await expect(window.locator('.onboarding-modal')).toBeVisible()

    // The shortcut list opens over the guide and closes again with the same keys.
    await window.keyboard.press('Control+/')
    await expect(window.locator('.shortcuts-modal')).toBeVisible()
    await window.keyboard.press('Control+/')
    await expect(window.locator('.shortcuts-modal')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Ctrl+plus, Ctrl+minus and Ctrl+wheel zoom the interface in steps and remember it', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    const zoom = () => window.evaluate(async () => (await window.api.config.get()).interfaceZoom)
    await window.keyboard.press('Control+=')
    await expect.poll(zoom).toBe(110)
    await window.keyboard.press('Control+=')
    await expect.poll(zoom).toBe(120)
    await window.keyboard.press('Control+-')
    await expect.poll(zoom).toBe(110)

    // The wheel zooms too: scrolling up with Ctrl enlarges, down shrinks.
    await window.locator('.app-main').hover()
    await window.keyboard.down('Control')
    await window.mouse.wheel(0, -100)
    await expect.poll(zoom).toBe(120)
    await window.mouse.wheel(0, 100)
    await window.mouse.wheel(0, 100)
    await expect.poll(zoom).toBe(100)
    await window.keyboard.up('Control')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the sidebar highlights the open page, hands over its indicator and keeps a dragged width', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    const active = window.locator('.nav-item.active')
    await expect(active).toHaveText(/记录/)
    await window.locator('.nav-item', { hasText: '日历' }).click()
    await expect(active).toHaveCount(1)
    await expect(active).toHaveText(/日历/)
    await expect(window.locator('.cal-slide')).toBeVisible()

    // The indicator sits behind the active item.
    await expect.poll(async () => {
      const indicator = await window.locator('.nav-indicator').boundingBox()
      const item = await active.boundingBox()
      return indicator && item && Math.abs(indicator.y - item.y) < 2 && Math.abs(indicator.height - item.height) < 2
    }).toBe(true)

    const sidebar = window.locator('.sidebar')
    const before = (await sidebar.boundingBox()).width
    const handle = await window.locator('.sidebar-resize-handle').boundingBox()
    // Only the part of the handle inside the sidebar is clickable (the rest is clipped).
    await window.mouse.move(handle.x + 1, handle.y + handle.height / 2)
    await window.mouse.down()
    await window.mouse.move(handle.x + 60, handle.y + handle.height / 2, { steps: 5 })
    await window.mouse.up()
    await expect.poll(async () => (await sidebar.boundingBox()).width).toBeGreaterThan(before)
    const after = (await sidebar.boundingBox()).width
    expect(after).toBeLessThanOrEqual(280)

    await window.reload()
    await window.waitForSelector('.sidebar')
    expect(Math.round((await window.locator('.sidebar').boundingBox()).width)).toBe(Math.round(after))
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('every page opens from the sidebar and "/" shows the record page', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    const pages = [
      ['便签', '.notes-page'],
      ['时间线', '.timeline-page'],
      ['日历', '.calendar-page'],
      ['数据分析', '.analytics-page'],
      ['设置', '.settings-page'],
      ['记录', '.today-content']
    ]
    for (const [label, selector] of pages) {
      await window.locator('.nav-item', { hasText: label }).click()
      await expect(window.locator(selector).first()).toBeVisible()
      await expect(window.locator('.nav-item.active')).toHaveText(new RegExp(label))
    }
    await window.evaluate(() => { window.location.hash = '#/' })
    await expect(window.locator('.today-content')).toBeVisible()
    await expect(window.locator('.nav-item.active')).toHaveText(/记录/)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a text field gets the in-app edit menu, the editor keeps its own', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.waitForSelector('.settings-page')
    const field = window.locator('.settings-page input:visible').first()
    await field.click({ button: 'right' })
    const menu = window.locator('.app-context-menu')
    await expect(menu).toBeVisible()
    await expect(menu).toContainText('粘贴')
    await window.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
