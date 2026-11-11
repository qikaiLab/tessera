import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

async function openSettings(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '设置' }).click()
  await launched.window.waitForSelector('.settings-page')
  return launched
}

async function readSections(sandbox) {
  return JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'sections.json'), 'utf8'))
}

test('the settings tabs switch, remember the last one and keep every card mounted', async ({ sandbox }) => {
  const { app, window, problems } = await openSettings(sandbox)
  try {
    await expect(window.getByRole('tab', { name: '外观' })).toHaveAttribute('aria-selected', 'true')
    await expect(window.locator('.appearance-settings-card')).toBeVisible()
    await expect(window.locator('.add-section-form')).toBeHidden()

    await window.getByRole('tab', { name: '编辑器' }).click()
    await expect(window.locator('.settings-typesetting-grid')).toBeVisible()
    await expect(window.locator('.appearance-settings-card')).toBeHidden()
    // Four typesetting fields, each with a hint.
    await expect(window.locator('.settings-field')).toHaveCount(4)

    // The page remembers the tab for the next visit.
    await window.locator('.nav-item', { hasText: '记录' }).click()
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await expect(window.getByRole('tab', { name: '编辑器' })).toHaveAttribute('aria-selected', 'true')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('sections can be added, renamed, pinned and deleted from the settings', async ({ sandbox }) => {
  const { app, window, problems } = await openSettings(sandbox)
  try {
    await window.getByRole('tab', { name: '数据版块' }).click()
    const before = await readSections(sandbox)

    // Add a number section with a carry-over default.
    await window.getByPlaceholder('版块名称 (如: 阅读, 体重...)').fill('体重')
    await window.getByRole('button', { name: '版块类型' }).click()
    await window.getByRole('option', { name: '数字' }).click()
    await window.getByPlaceholder('单位 (如: kg, min)').fill('kg')
    await window.getByRole('button', { name: '数字默认填充方式', exact: true }).click()
    await window.getByRole('option', { name: '延续前一日数据' }).click()
    await window.getByRole('button', { name: '添加版块' }).click()
    // The new section is appended; while its name is being edited it has no text to match.
    const row = window.locator('.settings-section-item').last()
    await expect(row).toBeVisible()
    await expect(row.locator('.sec-item-type')).toContainText('[kg]')
    // The form starts over.
    await expect(window.getByPlaceholder('版块名称 (如: 阅读, 体重...)')).toHaveValue('')
    await expect.poll(async () => (await readSections(sandbox)).length).toBe(before.length + 1)
    const saved = (await readSections(sandbox)).find(section => section.name === '体重')
    expect(saved).toMatchObject({ type: 'number', unit: 'kg', numberDefaultMode: 'carry', resident: false })

    // Rename inline.
    await row.locator('.sec-item-name-editable').click()
    await row.locator('.sec-item-name-input').fill('体重记录')
    await row.locator('.sec-item-name-input').press('Enter')
    await expect(window.locator('.settings-section-item', { hasText: '体重记录' })).toBeVisible()

    // Pin it as resident.
    const renamed = window.locator('.settings-section-item').last()
    await renamed.getByRole('button', { name: /常驻/ }).click()
    await expect.poll(async () => (await readSections(sandbox)).find(section => section.name === '体重记录')?.resident).toBe(true)

    // Delete it: nothing is recorded for it, so the dialog lets it go.
    await renamed.getByRole('button', { name: /删除版块/ }).click()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('可以安全删除')
    await dialog.getByRole('button', { name: '确定删除' }).click()
    await expect(window.locator('.settings-section-item', { hasText: '体重记录' })).toHaveCount(0)
    await expect.poll(async () => (await readSections(sandbox)).length).toBe(before.length)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a section that holds data on any day cannot be deleted', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
    { id: 'steps', name: '步数', type: 'number', unit: '步', resident: false, order: 1 }
  ]))
  const now = new Date()
  const file = path.join(sandbox.dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(now.getDate())}.json`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ steps: { value: '8000', updatedAt: now.toISOString() } }))

  const { app, window, problems } = await openSettings(sandbox)
  try {
    await window.getByRole('tab', { name: '数据版块' }).click()
    await window.locator('.settings-section-item', { hasText: '步数' }).getByRole('button', { name: /删除版块/ }).click()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('无法删除此版块')
    await expect(dialog.getByRole('button', { name: '确定删除' })).toHaveCount(0)
    await dialog.getByRole('button', { name: '知道了' }).click()
    await expect(dialog).toHaveCount(0)
    expect((await readSections(sandbox)).some(section => section.id === 'steps')).toBe(true)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a section is kept while a day cannot be read, since that day may hold data for it', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
    { id: 'steps', name: '步数', type: 'number', unit: '步', resident: false, order: 1 }
  ]))
  const now = new Date()
  const file = path.join(sandbox.dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(now.getDate())}.json`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const broken = '{"steps": {"value": "80'
  await fs.writeFile(file, broken)

  const { app, window } = await openSettings(sandbox)
  try {
    await window.getByRole('tab', { name: '数据版块' }).click()
    await window.locator('.settings-section-item', { hasText: '步数' }).getByRole('button', { name: /删除版块/ }).click()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('暂时无法删除此版块')
    // It names the day that cannot be read, and the ways out: try again later, or take the section off the day page.
    await expect(dialog).toContainText(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
    await expect(dialog).toContainText('稍后再点一次删除')
    await expect(dialog).toContainText('取消常驻')
    await expect(dialog.getByRole('button', { name: '确定删除' })).toHaveCount(0)
    await dialog.getByRole('button', { name: '知道了' }).click()
    expect((await readSections(sandbox)).some(section => section.id === 'steps')).toBe(true)
    // Nothing was touched on the way.
    expect(await fs.readFile(file, 'utf8')).toBe(broken)
  } finally {
    await app.close()
  }
})

test('the appearance card shows the controls of the chosen style', async ({ sandbox }) => {
  const { app, window, problems } = await openSettings(sandbox)
  try {
    // The default style offers accent colours; frosted glass offers a background instead.
    await expect(window.locator('.appearance-accent-panel')).toBeVisible()
    await expect(window.locator('.appearance-background-panel')).toHaveCount(0)

    await window.getByRole('radio', { name: /雾化玻璃/ }).click()
    await expect(window.locator('.appearance-background-panel')).toBeVisible()
    await expect(window.locator('.appearance-accent-panel')).toHaveCount(0)
    await expect(window.locator('.appearance-background-blur-slider')).toBeVisible()

    // The display card keeps zoom, font and weight together.
    await expect(window.locator('.interface-zoom-slider')).toBeVisible()
    await expect(window.getByRole('radio', { name: /常规|标准/ }).first()).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
