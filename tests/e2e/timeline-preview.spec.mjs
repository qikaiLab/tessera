import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

function dayInfo(daysAgo) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return {
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    file: [String(date.getFullYear()), pad(date.getMonth() + 1), `${pad(date.getDate())}.json`]
  }
}

const doc = (...paragraphs) => JSON.stringify({
  type: 'doc',
  content: paragraphs.map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
})

async function seed(sandbox) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
    { id: 'study', name: '学习', type: 'text', unit: '', resident: false, order: 1 },
    { id: 'running', name: '跑步', type: 'number', unit: 'm', resident: false, order: 2 }
  ]))
  const days = [
    [1, { diary: doc('昨天第一段', '昨天第二段，只有预览能看到完整内容'), running: '3000' }],
    [2, { diary: doc('前天的日记里提到了咖啡'), study: doc('学习了线性代数') }],
    [5, { diary: doc('五天前的日记'), running: '5200' }]
  ]
  for (const [daysAgo, data] of days) {
    const { file } = dayInfo(daysAgo)
    const target = path.join(sandbox.dataDir, ...file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    const entries = Object.fromEntries(Object.entries(data).map(([id, value]) => [id, { value, updatedAt: new Date().toISOString() }]))
    await fs.writeFile(target, JSON.stringify(entries))
  }
}

async function openTimeline(sandbox) {
  await seed(sandbox)
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '时间线' }).click()
  await expect(launched.window.locator('.timeline-card')).toHaveCount(3)
  return launched
}

test('previews the filtered days in full without leaving the timeline', async ({ sandbox }) => {
  const { app, window, problems } = await openTimeline(sandbox)
  try {
    const list = window.locator('.timeline-list')
    await expect(list.getByText('昨天第二段，只有预览能看到完整内容')).toHaveCount(0)

    await window.getByRole('button', { name: /预览/ }).click()
    await expect(window.locator('.timeline-card')).toHaveCount(0)
    await expect(window.locator('.preview-day')).toHaveCount(3)
    await expect(window.locator('.preview-summary')).toContainText('3')
    // Full text of the newest day, newest first, with the number shown as a chip.
    await expect(window.locator('.preview-day').first()).toContainText('昨天第二段，只有预览能看到完整内容')
    await expect(window.locator('.preview-day').first().locator('.preview-number')).toContainText('3000')
    expect(new URL(window.url()).hash).toContain('timeline')

    // The same filters apply: a keyword narrows the days, a section hides the others.
    await window.getByPlaceholder('搜索记录内容...').fill('咖啡')
    await expect(window.locator('.preview-day')).toHaveCount(1)
    await expect(window.locator('.preview-day mark')).toHaveText('咖啡')
    await window.getByPlaceholder('搜索记录内容...').fill('')
    await expect(window.locator('.preview-day')).toHaveCount(3)

    await window.getByRole('button', { name: '筛选版块' }).click()
    await window.getByRole('option', { name: /学习/ }).click()
    await window.keyboard.press('Escape')
    await expect(window.locator('.preview-day')).toHaveCount(1)
    await expect(window.locator('.preview-day')).toContainText('学习了线性代数')
    await expect(window.locator('.preview-day')).not.toContainText('前天的日记里提到了咖啡')

    // Reverse the order, then leave the preview.
    await window.getByRole('button', { name: '清除' }).click()
    await window.getByRole('button', { name: /新到旧/ }).click()
    await expect(window.locator('.preview-day').first()).toContainText('五天前的日记')

    await window.getByRole('button', { name: '退出预览' }).click()
    await expect(window.locator('.preview-day')).toHaveCount(0)
    await expect(window.locator('.timeline-card')).toHaveCount(3)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a previewed day in the record page and filters several sections at once', async ({ sandbox }) => {
  const { app, window, problems } = await openTimeline(sandbox)
  try {
    // Several sections can be selected together (list view).
    await window.getByRole('button', { name: '筛选版块' }).click()
    await window.getByRole('option', { name: /学习/ }).click()
    await window.getByRole('option', { name: /跑步/ }).click()
    await window.keyboard.press('Escape')
    await expect(window.locator('.timeline-card')).toHaveCount(3)
    await window.getByRole('button', { name: '清除' }).click()

    await window.getByRole('button', { name: /预览/ }).click()
    await window.locator('.preview-day').nth(1).getByRole('button', { name: /在记录页打开/ }).click()
    await expect(window.locator('.nav-item.active')).toContainText('记录')
    await expect(window.locator('.sections-grid .ProseMirror').first()).toContainText('前天的日记里提到了咖啡')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
