import { test, expect, launchApp } from './fixtures.mjs'

// A backdrop-filter only sees the real backdrop when none of its ancestors has opacity < 1,
// a filter or a mask. If one does (even briefly, during an animation) the glass renders flat
// and then visibly changes colour when the animation ends. This walks every glass element on
// every frame of a transition and reports ancestors that would cut off its backdrop.
async function openFrosted(sandbox) {
  const launched = await launchApp(sandbox)
  const { window } = launched
  await window.evaluate(async () => {
    await window.api.config.set('onboardingDone', true)
    await window.api.config.set('interfaceStyle', 'frosted-glass')
    await window.api.config.set('theme', 'dark')
  })
  await window.reload()
  await window.waitForSelector('.sidebar')
  await window.waitForTimeout(600)
  await window.evaluate(() => {
    const cutsBackdrop = el => {
      const style = getComputedStyle(el)
      const reasons = []
      if (Number.parseFloat(style.opacity) < 1) reasons.push(`opacity ${style.opacity}`)
      if (style.filter !== 'none') reasons.push('filter')
      if (style.maskImage && style.maskImage !== 'none') reasons.push('mask')
      return reasons
    }
    // Records offenders on each animation frame for `ms`, resolves with the distinct ones.
    window.__watchGlass = ms => new Promise(resolve => {
      const found = new Set()
      const start = performance.now()
      const frame = now => {
        for (const glass of document.querySelectorAll('*')) {
          const backdrop = getComputedStyle(glass).backdropFilter
          if (!backdrop || backdrop === 'none') continue
          for (let node = glass.parentElement; node && node !== document.documentElement; node = node.parentElement) {
            const reasons = cutsBackdrop(node)
            if (reasons.length) found.add(`${node.className || node.tagName} (${reasons.join(', ')}) above ${glass.className}`)
          }
        }
        if (now - start < ms) requestAnimationFrame(frame); else resolve([...found])
      }
      requestAnimationFrame(frame)
    })
  })
  return launched
}

test('glass is never cut off while pages change', async ({ sandbox }) => {
  const { app, window, problems } = await openFrosted(sandbox)
  try {
    for (const page of ['时间线', '便签', '数据分析', '设置', '日历', '记录']) {
      await window.evaluate(() => { window.__glass = window.__watchGlass(450) })
      await window.locator('.nav-item', { hasText: page }).click()
      expect(await window.evaluate(() => window.__glass), `entering ${page}`).toEqual([])
    }
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('glass stays intact with the notes drawer, day switches and dialogs', async ({ sandbox }) => {
  const { app, window, problems } = await openFrosted(sandbox)
  try {
    await window.waitForTimeout(500)
    await window.evaluate(() => { window.__glass = window.__watchGlass(600) })
    await window.locator('.today-notes-toggle').first().click()
    expect(await window.evaluate(() => window.__glass), 'opening the drawer').toEqual([])
    await expect(window.locator('.notes-drawer')).toBeVisible()
    await window.waitForTimeout(400)
    // With the drawer open the record pane must not hold a filter either.
    await window.evaluate(() => { window.__glass = window.__watchGlass(300) })
    expect(await window.evaluate(() => window.__glass), 'drawer resting').toEqual([])

    await window.evaluate(() => { window.__glass = window.__watchGlass(700) })
    await window.getByTitle('前一天').click()
    expect(await window.evaluate(() => window.__glass), 'switching day').toEqual([])

    await window.evaluate(() => { window.__glass = window.__watchGlass(500) })
    await window.keyboard.press('Control+/')
    expect(await window.evaluate(() => window.__glass), 'opening a dialog').toEqual([])
    await window.evaluate(() => { window.__glass = window.__watchGlass(400) })
    await window.keyboard.press('Escape')
    expect(await window.evaluate(() => window.__glass), 'closing a dialog').toEqual([])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('glass stays intact in the calendar, in fullscreen and while notes load', async ({ sandbox }) => {
  const { app, window, problems } = await openFrosted(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '日历' }).click()
    await expect(window.locator('.cal-slide')).toBeVisible()
    await window.waitForTimeout(700)
    for (const action of [
      () => window.getByLabel('下一页').click(),
      () => window.getByLabel('上一页').click(),
      () => window.locator('.tabs .tab').nth(1).click(),
      () => window.locator('.tabs .tab').nth(2).click()
    ]) {
      await window.evaluate(() => { window.__glass = window.__watchGlass(650) })
      await action()
      expect(await window.evaluate(() => window.__glass), 'calendar motion').toEqual([])
    }

    await window.locator('.nav-item', { hasText: '记录' }).click()
    await window.waitForTimeout(800)
    await window.evaluate(() => { window.__glass = window.__watchGlass(700) })
    await window.locator('.fullscreen-btn').first().click()
    expect(await window.evaluate(() => window.__glass), 'entering fullscreen').toEqual([])
    await window.evaluate(() => { window.__glass = window.__watchGlass(600) })
    await window.keyboard.press('Escape')
    expect(await window.evaluate(() => window.__glass), 'leaving fullscreen').toEqual([])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('glass stays intact while the countdown drawer, its editors, rows and the strip move', async ({ sandbox }) => {
  const { app, window, problems } = await openFrosted(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '日历' }).click()
    await expect(window.locator('.cal-slide')).toBeVisible()
    await window.waitForTimeout(700)
    const watched = async (label, ms, action) => {
      await window.evaluate(span => { window.__glass = window.__watchGlass(span) }, ms)
      await action()
      expect(await window.evaluate(() => window.__glass), label).toEqual([])
    }
    const drawer = window.locator('aside.cd-drawer')

    await watched('opening the drawer (the strip folds away)', 800, () => window.locator('.cd-strip-manage').click())
    await expect(drawer.getByLabel('名称')).toBeVisible()
    await drawer.getByLabel('名称').fill('考试')
    await drawer.locator('input[type="date"]').fill('2099-05-20')
    await watched('adding one (the form folds shut, the row grows open)', 800, () => drawer.getByRole('button', { name: '添加', exact: true }).click())
    await expect(drawer.locator('.cd-row')).toHaveCount(1)
    await window.waitForTimeout(500)

    await watched('opening an editor', 800, () => drawer.locator('.cd-row').click())
    await watched('opening the step of a repeat', 600, () => drawer.getByRole('radio', { name: '每周' }).click())
    await watched('closing the step of a repeat', 600, () => drawer.getByRole('radio', { name: '不重复' }).click())
    await watched('closing an editor', 800, () => window.keyboard.press('Escape'))
    await expect(drawer.locator('.cd-edit')).toHaveCount(0)

    await drawer.locator('.cd-row').click()
    await expect(drawer.locator('.cd-edit')).toBeVisible()
    await window.waitForTimeout(500)
    await drawer.getByRole('button', { name: '删除', exact: true }).click()
    await watched('deleting one (the row folds away)', 900, () => drawer.getByRole('button', { name: '确认删除' }).click())
    await expect(drawer.locator('.cd-row')).toHaveCount(0)

    await watched('closing the drawer (the strip comes back)', 800, () => drawer.getByRole('button', { name: '关闭倒数日' }).click())
    await expect(drawer).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
