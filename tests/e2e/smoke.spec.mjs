import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const NAV_LABELS = ['记录', '便签', '时间线', '日历', '数据分析', '设置']

async function finishOnboarding(window) {
  await window.locator('.onboarding-overlay').waitFor()
  for (let i = 0; i < 5 && (await window.locator('.onboarding-overlay').count()); i += 1) {
    await window.locator('.onboarding-actions .btn-primary').click()
  }
  await expect(window.locator('.onboarding-overlay')).toHaveCount(0)
}

test('starts against the isolated data directory and renders every page', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    // Isolation guard: if this ever fails, a run could touch real user data.
    const dataDir = await window.evaluate(() => window.api.config.getDataDir())
    expect(path.resolve(dataDir)).toBe(path.resolve(sandbox.dataDir))
    expect(await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))).toBe(
      path.resolve(sandbox.userDataDir)
    )

    await finishOnboarding(window)

    for (const label of NAV_LABELS) {
      await window.locator('.nav-item', { hasText: label }).click()
      await expect(window.locator('.nav-item.active')).toContainText(label)
      await expect(window.locator('main.app-main')).toBeVisible()
    }
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('saves a diary entry and keeps it after a restart', async ({ sandbox }) => {
  const entry = `冒烟测试 ${Date.now()}`
  const first = await launchApp(sandbox)
  try {
    await finishOnboarding(first.window)
    await first.window.locator('.nav-item', { hasText: '记录' }).click()
    const editor = first.window.locator('.sections-grid .ProseMirror').first()
    await editor.click()
    await first.window.keyboard.type(entry)
    await first.window.keyboard.press('Control+s')

    const today = await first.window.evaluate(() => {
      const d = new Date()
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}.json`
    })
    const dayFile = path.join(sandbox.dataDir, ...today.split('/'))
    await expect.poll(async () => fs.readFile(dayFile, 'utf8').catch(() => ''), { timeout: 15_000 })
      .toContain(entry)
  } finally {
    await first.app.close()
  }

  const second = await launchApp(sandbox)
  try {
    await expect(second.window.locator('.sections-grid .ProseMirror').first()).toContainText(entry)
    expect(second.problems).toEqual([])
  } finally {
    await second.app.close()
  }
})
