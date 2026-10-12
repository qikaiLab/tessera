import { test, expect, launchApp } from './fixtures.mjs'

// The fullscreen editor is `position: fixed`. Any ancestor that keeps a transform (or an
// animation that fills a transform forwards) becomes its containing block, and the editor
// then only covers that ancestor instead of the whole window.
async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

async function expectCoversWindow(window, locator) {
  const viewport = await window.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  await expect.poll(() => locator.evaluate(el => {
    const { x, y, width, height } = el.getBoundingClientRect()
    return [Math.round(x), Math.round(y), Math.round(width), Math.round(height)]
  })).toEqual([0, 0, viewport.width, viewport.height])
}

test('a record card goes fullscreen over the whole window', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    // Wait out the page transition: the bug only showed once it had finished.
    await window.waitForTimeout(600)
    await window.locator('.fullscreen-btn').first().click()
    const shell = window.locator('.tiptap-shell.tiptap-fullscreen')
    await expect(shell).toBeVisible()
    await expectCoversWindow(window, shell)

    await window.keyboard.press('Escape')
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toHaveCount(0)
    await expect(window.locator('.fullscreen-btn').first()).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a note goes fullscreen over the whole window', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '便签' }).click()
    await window.getByTitle('新建便签').click()
    await window.waitForTimeout(600)
    await window.locator('button[title^="全屏编辑"]').click()
    const shell = window.locator('.tiptap-shell.tiptap-fullscreen')
    await expect(shell).toBeVisible()
    await expectCoversWindow(window, shell)

    await window.keyboard.press('Escape')
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
