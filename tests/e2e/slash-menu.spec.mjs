import { test, expect, launchApp } from './fixtures.mjs'

const EDITOR = '.sections-grid .ProseMirror'

async function openSlashMenu(window) {
  await window.evaluate(() => window.api.config.set('onboardingDone', true))
  await window.reload()
  await window.waitForSelector('.sidebar')
  await window.locator(EDITOR).first().click()
  await window.keyboard.type('/')
  const menu = window.locator('.slash-menu')
  await expect(menu).toBeVisible()
  return menu
}

// Whether the selected item is fully inside the menu's visible area, below its sticky header.
function selectedItemIsVisible(window) {
  return window.evaluate(() => {
    const menu = document.querySelector('.slash-menu')
    const header = menu.querySelector('.slash-menu-header').getBoundingClientRect()
    const box = menu.getBoundingClientRect()
    const item = menu.querySelector('.slash-menu-item.is-selected')?.getBoundingClientRect()
    return Boolean(item) && item.top >= header.bottom - 1 && item.bottom <= box.bottom + 1
  })
}

test('arrow keys walk the whole slash menu and keep the chosen item in view', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const menu = await openSlashMenu(window)
    const items = menu.locator('.slash-menu-item')
    const count = await items.count()
    // The list is longer than the box, which is what makes scrolling matter.
    expect(await menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
    await expect(menu.locator('.slash-menu-item', { hasText: '本地文件链接' })).toHaveCount(1)
    await expect(menu.locator('.slash-menu-item', { hasText: '本地文件夹链接' })).toHaveCount(1)

    // Down through every item, one step at a time.
    for (let index = 1; index < count; index += 1) {
      await window.keyboard.press('ArrowDown')
      await expect(items.nth(index)).toHaveClass(/is-selected/)
      expect(await selectedItemIsVisible(window)).toBe(true)
    }
    // Past the last item wraps to the first, and the list scrolls back with it.
    await window.keyboard.press('ArrowDown')
    await expect(items.nth(0)).toHaveClass(/is-selected/)
    expect(await selectedItemIsVisible(window)).toBe(true)
    expect(await menu.evaluate(el => el.scrollTop)).toBe(0)

    // Up from the first item wraps to the last, then back up through the list.
    await window.keyboard.press('ArrowUp')
    await expect(items.nth(count - 1)).toHaveClass(/is-selected/)
    expect(await selectedItemIsVisible(window)).toBe(true)
    for (let index = count - 2; index >= 0; index -= 1) {
      await window.keyboard.press('ArrowUp')
      await expect(items.nth(index)).toHaveClass(/is-selected/)
      expect(await selectedItemIsVisible(window)).toBe(true)
    }
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('hovering a half-visible item does not make the list scroll away', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const menu = await openSlashMenu(window)
    const items = menu.locator('.slash-menu-item')
    const box = await menu.boundingBox()

    // Pointer on the bottom edge, over the item that is only partly visible.
    await window.mouse.move(box.x + box.width / 2, box.y + box.height - 4)
    await window.mouse.move(box.x + box.width / 2, box.y + box.height - 6)
    await window.waitForTimeout(300)
    expect(await menu.evaluate(el => el.scrollTop)).toBe(0)
    await expect(items.nth(0)).not.toHaveClass(/is-selected/)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('typing narrows the slash menu to the local file items and Enter picks the highlighted one', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const menu = await openSlashMenu(window)
    await window.keyboard.type('本地文件')
    const items = menu.locator('.slash-menu-item')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('本地文件链接')
    await expect(items.nth(1)).toContainText('本地文件夹链接')
    await window.keyboard.press('ArrowDown')
    await expect(items.nth(1)).toHaveClass(/is-selected/)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the slash menu lists every command, including the last ones', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const menu = await openSlashMenu(window)
    await expect(menu.locator('.slash-menu-title')).toHaveText([
      '文本', '标题 1', '标题 2', '标题 3', '无序列表', '有序列表', '任务列表', '引用块', '代码块',
      '表格', '本地文件链接', '本地文件夹链接', '分割线'
    ])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
