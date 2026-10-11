import { test, expect, launchApp } from './fixtures.mjs'

async function openToday(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

async function writeLines(window, count) {
  const editor = window.locator('.sections-grid .ProseMirror').first()
  await editor.click()
  for (let i = 1; i <= count; i += 1) {
    await window.keyboard.type(`第${i}行`)
    if (i < count) await window.keyboard.press('Enter')
  }
}

test('shows a back-to-top button only after scrolling down', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    const button = window.getByRole('button', { name: '回到顶端' })
    await expect(button).not.toBeVisible()

    await writeLines(window, 60)
    const content = window.locator('.today-content')
    await content.evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(button).toBeVisible()

    await button.click()
    await expect.poll(() => content.evaluate(el => el.scrollTop)).toBe(0)
    await expect(button).not.toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('collapses and expands a record card without losing content', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    await writeLines(window, 3)
    const card = window.locator('.section-card').first()
    const toggle = card.locator('.section-collapse-btn')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(card.locator('.char-count-badge')).toContainText('9 字')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(card.locator('.section-card-body')).toBeHidden()
    await expect(card.locator('.section-collapsed-preview')).toContainText('第1行 第2行 第3行')
    await expect(card.locator('.char-count-badge')).toContainText('9 字')

    // Collapsing is per day: the same card on another date stays open.
    await window.locator('button[title="前一天"]').click()
    await expect(window.locator('.section-card').first().locator('.section-card-body')).toBeVisible()
    await window.locator('button[title="后一天"]').click()

    await window.locator('.section-card').first().locator('.section-collapsed-preview').click()
    await expect(window.locator('.section-card').first().locator('.section-card-body')).toBeVisible()
    await expect(window.locator('.sections-grid .ProseMirror').first()).toContainText('第3行')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
