import { test, expect, launchApp } from './fixtures.mjs'

test('bubble toolbar converts selected paragraphs to and from lists', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')

    const editor = window.locator('.sections-grid .ProseMirror').first()
    await editor.click()
    await window.keyboard.type('第一行')
    await window.keyboard.press('Enter')
    await window.keyboard.type('第二行')
    await window.keyboard.press('Enter')
    await window.keyboard.type('第三行')
    await window.keyboard.press('Control+a')

    const toolbar = window.locator('.bubble-toolbar.is-visible')
    await expect(toolbar).toBeVisible()
    const button = title => toolbar.locator(`button[title="${title}"]`)

    await button('无序列表').click()
    await expect(editor.locator('ul:not([data-type="taskList"]) > li')).toHaveCount(3)
    await expect(button('无序列表')).toHaveClass(/is-active/)
    await expect(button('有序列表')).not.toHaveClass(/is-active/)

    await button('有序列表').click()
    await expect(editor.locator('ol > li')).toHaveCount(3)
    await expect(editor.locator('ul')).toHaveCount(0)
    await expect(button('有序列表')).toHaveClass(/is-active/)
    await expect(button('无序列表')).not.toHaveClass(/is-active/)

    await button('任务列表').click()
    await expect(editor.locator('ul[data-type="taskList"] > li')).toHaveCount(3)
    await expect(editor.locator('ol')).toHaveCount(0)
    await expect(button('任务列表')).toHaveClass(/is-active/)

    await button('任务列表').click()
    await expect(editor.locator('ul, ol')).toHaveCount(0)
    // The editor keeps an empty trailing paragraph once a list has been the last block.
    await expect(editor.locator('p:not(:empty):not(.is-empty)')).toHaveText(['第一行', '第二行', '第三行'])
    expect(problems).toEqual([])

  } finally {
    await app.close()
  }
})
