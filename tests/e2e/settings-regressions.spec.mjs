import { test, expect, launchApp } from './fixtures.mjs'

async function openSettings(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '设置' }).click()
  return launched
}

test('clicking and dragging a section handle in settings never crashes the page', async ({ sandbox }) => {
  const { app, window, problems } = await openSettings(sandbox)
  try {
    await window.getByRole('tab', { name: '数据版块' }).click()
    const handles = window.locator('.drag-handle')
    await expect(handles).toHaveCount(2)
    await handles.first().scrollIntoViewIfNeeded()
    await handles.first().click()

    const names = () => window.locator('.settings-section-item .section-card-title, .settings-section-item .settings-section-name')
      .allInnerTexts()
    const before = await names()

    // Dropped far outside every row: nothing moves and nothing throws.
    const box = await handles.first().boundingBox()
    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await window.mouse.down()
    await window.mouse.move(2, 2, { steps: 10 })
    await window.mouse.up()

    await expect(window.locator('.sidebar')).toBeVisible()
    await expect(window.locator('.error-boundary')).toHaveCount(0)
    expect(await names()).toEqual(before)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the automatic history dialog closes with Escape', async ({ sandbox }) => {
  const { app, window } = await openSettings(sandbox)
  try {
    await window.getByRole('tab', { name: '数据与备份' }).click()
    await window.getByRole('button', { name: '查看自动历史' }).click()
    await expect(window.getByRole('dialog', { name: '自动历史' })).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(window.getByRole('dialog', { name: '自动历史' })).toHaveCount(0)
  } finally {
    await app.close()
  }
})

test('section type and fill-mode menus work in settings', async ({ sandbox }) => {
  const { app, window, problems } = await openSettings(sandbox)
  try {
    await window.getByRole('tab', { name: '数据版块' }).click()
    await expect(window.locator('select')).toHaveCount(0)

    await window.getByRole('button', { name: '版块类型' }).click()
    await window.getByRole('option', { name: '数字' }).click()
    await window.getByPlaceholder(/版块名称/).fill('喝水')
    await window.getByRole('button', { name: '数字默认填充方式', exact: true }).click()
    await window.getByRole('option', { name: '延续前一日数据' }).click()
    await window.getByRole('button', { name: '添加版块' }).click()
    const row = window.locator('.settings-section-item', { hasText: '喝水' })
    await expect(row).toBeVisible()

    // The per-section menu changes the mode; opening it must not start a drag.
    await row.getByRole('button', { name: /喝水的数字默认填充方式/ }).click()
    await window.getByRole('option', { name: '每日手动输入' }).click()
    await expect(row.getByRole('button', { name: /喝水的数字默认填充方式/ })).toContainText('每日手动输入')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
