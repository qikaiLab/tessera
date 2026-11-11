import { test, expect, launchApp } from './fixtures.mjs'

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

const TOPICS = ['快速开始', '记录页', '写作与 Markdown', '表格', '便签', '时间线与日历', '数据分析', '设置与数据', '快捷键速查', '常见问题']

test('the guide lists every topic and switches between them', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.getByTitle('使用说明').click()
    const dialog = window.getByRole('dialog', { name: '使用说明' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('tab')).toHaveText(TOPICS.map(title => new RegExp(title)))
    await expect(dialog.getByRole('tab', { selected: true })).toContainText('快速开始')

    await dialog.getByRole('tab', { name: /表格/ }).click()
    await expect(dialog.locator('.guide-topic-title')).toHaveText('表格')
    await expect(dialog.getByRole('tab', { selected: true })).toContainText('表格')

    // Previous / next walk the topics in order.
    await dialog.locator('.guide-pager-btn.is-next').click()
    await expect(dialog.locator('.guide-topic-title')).toHaveText('便签')
    await dialog.locator('.guide-pager-btn:not(.is-next)').click()
    await expect(dialog.locator('.guide-topic-title')).toHaveText('表格')

    // Arrow keys move through the topic list.
    await dialog.getByRole('tab', { name: /表格/ }).focus()
    await window.keyboard.press('ArrowDown')
    await expect(dialog.locator('.guide-topic-title')).toHaveText('便签')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the guide takes focus when it opens and gives it back to the button that opened it', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    const opener = window.getByTitle('使用说明')
    await opener.focus()
    await opener.click()
    const dialog = window.getByRole('dialog', { name: '使用说明' })
    await expect(dialog).toBeVisible()
    // Focus is on the scrolling article (so the arrow and page keys work), inside the dialog.
    await expect.poll(() => window.evaluate(() => document.activeElement?.id)).toBe('guide-panel')
    await window.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('searching narrows the topics, Esc clears the search first and then closes the guide', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.keyboard.press('F1')
    const dialog = window.getByRole('dialog', { name: '使用说明' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('搜索说明').fill('合并单元格')
    await expect(dialog.getByRole('tab')).toHaveCount(1)
    await expect(dialog.locator('.guide-topic-title')).toHaveText('表格')
    await expect(dialog.locator('.guide-article mark').first()).toBeVisible()

    await dialog.getByLabel('搜索说明').fill('zzzzqqqq')
    await expect(dialog.getByRole('tab')).toHaveCount(0)
    await expect(dialog.getByText('没有找到相关说明')).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(dialog.getByLabel('搜索说明')).toHaveValue('')
    await expect(dialog.getByRole('tab')).toHaveCount(TOPICS.length)
    await expect(dialog).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(window.locator('.onboarding-overlay')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the shortcut list opens from the guide and Esc closes only that list', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.keyboard.press('F1')
    await window.getByRole('tab', { name: /快捷键速查/ }).click()
    await window.getByRole('button', { name: /打开完整快捷键清单/ }).click()
    await expect(window.locator('.shortcuts-modal')).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(window.locator('.shortcuts-modal')).toHaveCount(0)
    await expect(window.locator('.onboarding-modal')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('no topic overflows sideways, in a wide and in a narrow window', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.keyboard.press('F1')
    const dialog = window.getByRole('dialog', { name: '使用说明' })
    await expect(dialog).toBeVisible()

    const overflow = () => window.evaluate(() => {
      const scroll = document.querySelector('.guide-scroll')
      const modal = document.querySelector('.onboarding-modal')
      return {
        pane: scroll.scrollWidth - scroll.clientWidth,
        modal: modal.scrollWidth - modal.clientWidth,
        fits: modal.getBoundingClientRect().right <= window.innerWidth && modal.getBoundingClientRect().bottom <= window.innerHeight
      }
    })

    for (const width of [0, 640]) {
      if (width) {
        await app.evaluate(({ BrowserWindow }, value) => {
          const target = BrowserWindow.getAllWindows()[0]
          target.setMinimumSize(300, 300)
          target.setSize(value, 800)
        }, width)
        await window.waitForTimeout(400)
      }
      for (const title of TOPICS) {
        await dialog.getByRole('tab', { name: new RegExp(title) }).click()
        await expect(dialog.locator('.guide-topic-title')).toHaveText(title)
        const measured = await overflow()
        expect(measured.pane, `${title} @${width}`).toBeLessThanOrEqual(0)
        expect(measured.modal, `${title} @${width}`).toBeLessThanOrEqual(0)
        expect(measured.fits, `${title} @${width}`).toBe(true)
      }
    }
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

// A dialog whose background went transparent (a broken image url once did that to the fullscreen
// editor of two themes) is unreadable, so check that each style paints a solid surface.
for (const style of ['default', 'linen-study', 'jade-archive']) {
  test(`${style}: the guide has an opaque surface and readable text`, async ({ sandbox }) => {
    const { app, window, problems } = await openApp(sandbox)
    try {
      await window.evaluate(value => window.api.config.set('interfaceStyle', value), style)
      await window.reload()
      await window.waitForSelector('.sidebar')
      await window.keyboard.press('F1')
      await expect(window.locator('.onboarding-modal')).toBeVisible()
      await window.waitForTimeout(500)

      const paint = await window.evaluate(() => {
        const alpha = value => {
          const match = value.match(/rgba?\(([^)]+)\)/)
          if (!match) return 0
          const parts = match[1].split(',').map(Number)
          return parts.length > 3 ? parts[3] : 1
        }
        const modal = getComputedStyle(document.querySelector('.onboarding-modal'))
        const text = getComputedStyle(document.querySelector('.guide-text'))
        return { background: alpha(modal.backgroundColor), textAlpha: alpha(text.color) }
      })
      expect(paint.background).toBeGreaterThan(0.9)
      expect(paint.textAlpha).toBeGreaterThan(0.5)
      expect(problems).toEqual([])
    } finally {
      await app.close()
    }
  })
}
