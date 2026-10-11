import { test, expect, launchApp } from './fixtures.mjs'

async function openAnalytics(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '数据分析' }).click()
  return launched
}

test('keeps chart data when the chart type changes and animates the editor', async ({ sandbox }) => {
  const { app, window, problems } = await openAnalytics(sandbox)
  try {
    await window.getByRole('button', { name: /新建图表/ }).first().click()
    const card = window.locator('.analytics-card.editing')
    await expect(card).toBeVisible()
    const chips = card.locator('.series-chip')

    // Themed multi-select instead of a native <select>.
    await expect(card.locator('select')).toHaveCount(0)
    await card.getByRole('button', { name: '选择要展示的数据' }).click()
    const menu = window.getByRole('listbox', { name: '选择要展示的数据' })
    await expect(menu).toBeVisible()
    await menu.getByRole('option', { name: /日记/ }).click()
    await menu.getByRole('option', { name: /今日跑步/ }).click()
    await expect(menu).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(chips).toHaveCount(2)

    const typeButton = name => card.getByRole('radio', { name })
    for (const name of ['折线图', '饼图', '热力图', '柱状图']) {
      await typeButton(name).click()
      await expect(typeButton(name)).toHaveAttribute('aria-checked', 'true')
      await expect(chips).toHaveCount(2)
    }

    // A heatmap draws the first series only, but the second one is remembered.
    await typeButton('热力图').click()
    await expect(chips.nth(1)).toHaveClass(/is-unused/)
    await typeButton('折线图').click()
    await expect(chips.nth(1)).not.toHaveClass(/is-unused/)
    await expect(chips).toHaveCount(2)

    // Collapsing animates instead of disappearing, and hides the panel afterwards.
    const collapse = card.locator('.card-editor-collapse')
    const duration = await collapse.evaluate(el => getComputedStyle(el).transitionDuration)
    expect(duration).not.toBe('0s')
    await card.getByTitle('配置').click()
    await expect(card.locator('.card-editor-collapse-inner')).toBeHidden()
    await window.locator('.analytics-card').first().getByTitle('配置').click()
    await expect(window.locator('.analytics-card').first().locator('.series-chip')).toHaveCount(2)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
