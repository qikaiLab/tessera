import { test, expect, launchApp } from './fixtures.mjs'

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

test('switching days quickly never leaves the record page blank', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    const editor = window.locator('.sections-grid .ProseMirror').first()
    await editor.click()
    await window.keyboard.type('今天的记录')
    // Let the debounced save run so leaving the day does not depend on it.
    await window.waitForTimeout(1200)

    const dateLabel = window.locator('.today-date-sub')
    const today = await dateLabel.textContent()
    const prev = window.getByTitle('前一天')
    const next = window.getByTitle('后一天')

    // Hammer the arrows: every click starts a new transition on top of the previous one.
    await prev.click()
    await prev.click()
    await prev.click()
    await expect(dateLabel).not.toHaveText(today)
    await expect(window.locator('.sections-grid .section-card').first()).toBeVisible()
    await expect(window.locator('.today-content')).not.toHaveClass(/is-date-leaving/)

    await next.click()
    await next.click()
    await next.click()
    await expect(dateLabel).toHaveText(today)
    await expect(window.locator('.sections-grid .ProseMirror').first()).toContainText('今天的记录')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('dialogs play their exit and are then removed', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.keyboard.press('Control+/')
    const overlay = window.locator('.shortcuts-overlay')
    await expect(overlay).toBeVisible()

    await window.keyboard.press('Escape')
    // Mid-exit the dialog is hidden from assistive tech and cannot take clicks...
    await expect(window.locator('.presence.is-leaving')).toHaveAttribute('aria-hidden', 'true')
    // ...and shortly afterwards it is gone from the DOM entirely.
    await expect(overlay).toHaveCount(0)
    await expect(window.locator('.presence')).toHaveCount(0)

    // Re-opening straight away still works.
    await window.keyboard.press('Control+/')
    await expect(overlay).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the sidebar highlight follows the current page', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    const indicator = window.locator('.nav-indicator')
    await expect(indicator).toHaveCount(1)
    const offset = () => indicator.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)

    await window.locator('.nav-item', { hasText: '时间线' }).click()
    const target = await window.locator('.nav-item', { hasText: '时间线' }).evaluate(el => el.offsetTop)
    // The highlight glides, so wait for it to settle on the item rather than assume a frame.
    await expect.poll(offset).toBeCloseTo(target, 0)

    await window.locator('.nav-item', { hasText: '设置' }).click()
    const settings = await window.locator('.nav-item', { hasText: '设置' }).evaluate(el => el.offsetTop)
    await expect.poll(offset).toBeCloseTo(settings, 0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('tab strips slide a highlight to the selected tab', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '设置' }).click()
    const tabs = window.locator('.settings-tabs')
    await expect(tabs).toHaveClass(/has-thumb/)
    const thumbX = () => tabs.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el, '::before').transform).m41)

    const second = window.locator('.settings-tabs [role="tab"]').nth(1)
    await second.click()
    const left = await second.evaluate(el => el.offsetLeft)
    await expect.poll(thumbX).toBeCloseTo(left, 0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('folding a record card takes longer for long text and survives quick clicks', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(600)
    const card = window.locator('.sections-grid .section-card').first()
    const toggle = card.locator('.section-collapse-btn')
    const duration = async () => Number.parseFloat(await card.evaluate(el => el.style.getPropertyValue('--collapse-ms')))

    await toggle.click()
    await expect(card).toHaveClass(/is-collapsed/)
    const shortMs = await duration()
    await toggle.click()
    await expect(card).not.toHaveClass(/is-collapsed/)

    await card.locator('.ProseMirror').click()
    for (let line = 0; line < 40; line += 1) {
      await window.keyboard.type(`一行较长的内容 ${line}`)
      await window.keyboard.press('Enter')
    }
    await toggle.click()
    await expect(card).toHaveClass(/is-collapsed/)
    const longMs = await duration()
    expect(longMs).toBeGreaterThan(shortMs + 150)
    expect(longMs).toBeLessThanOrEqual(620)
    expect(shortMs).toBeGreaterThanOrEqual(240)

    // Clicking again mid-flight reverses cleanly and ends fully open and readable.
    await window.waitForTimeout(100)
    await toggle.click()
    await window.waitForTimeout(80)
    await toggle.click()
    await window.waitForTimeout(80)
    await toggle.click()
    await expect(card).not.toHaveClass(/is-collapsed/)
    await expect(card.locator('.ProseMirror')).toBeVisible()
    const body = card.locator('.text-editor-body')
    await expect.poll(() => body.evaluate(el => Math.round(el.getBoundingClientRect().height))).toBeGreaterThan(300)
    await expect(body).toHaveCSS('opacity', '1')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the shortcut list opened from the guide adds no second dimming layer', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    // How many full-window layers currently dim the page behind the dialogs.
    const dimmingLayers = () => window.evaluate(() => [...document.querySelectorAll('.onboarding-overlay, .shortcuts-overlay')]
      .filter(el => !el.closest('.presence.is-leaving'))
      .filter(el => {
        const before = getComputedStyle(el, '::before')
        const own = getComputedStyle(el)
        const visible = value => {
          const match = value.match(/rgba?\(([^)]+)\)/)
          if (!match) return false
          const parts = match[1].split(',').map(Number)
          return (parts.length > 3 ? parts[3] : 1) > 0
        }
        return visible(before.backgroundColor) || visible(own.backgroundColor)
      }).length)

    await window.getByTitle('使用说明').click()
    await expect(window.locator('.onboarding-overlay')).toBeVisible()
    expect(await dimmingLayers()).toBe(1)

    // The shortcut list is offered from the shortcuts topic of the guide.
    await window.getByRole('tab', { name: /快捷键速查/ }).click()
    await window.getByRole('button', { name: /打开完整快捷键清单/ }).click()
    await expect(window.locator('.shortcuts-overlay')).toBeVisible()
    await window.waitForTimeout(400)
    expect(await dimmingLayers()).toBe(1)

    // Closing the list leaves the guide dimmed exactly as before.
    await window.keyboard.press('Escape')
    await expect(window.locator('.shortcuts-overlay')).toHaveCount(0)
    expect(await dimmingLayers()).toBe(1)

    // Opened on its own, the list dims the page itself.
    await window.getByRole('button', { name: '关闭', exact: true }).first().click()
    await expect(window.locator('.onboarding-overlay')).toHaveCount(0)
    await window.keyboard.press('Control+/')
    await expect(window.locator('.shortcuts-overlay')).toBeVisible()
    await window.waitForTimeout(400)
    expect(await dimmingLayers()).toBe(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
