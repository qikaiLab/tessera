import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

test('an unreadable sections file is kept on disk instead of being replaced by defaults', async ({ sandbox }) => {
  const broken = '[{"id": "diary", "name": "我的日记", "type": "text"'
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), broken)

  const { app, window } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')

    await expect(window.getByText(/版块配置文件无法读取/)).toBeVisible()
    // The app still works on the default sections...
    await expect(window.locator('.sections-grid .ProseMirror').first()).toBeVisible()
    // ...and the original file was left exactly as it was.
    expect(await fs.readFile(path.join(sandbox.dataDir, 'sections.json'), 'utf8')).toBe(broken)
  } finally {
    await app.close()
  }
})

test('an unreadable metadata file is reported and only replaced once the user changes something', async ({ sandbox }) => {
  const broken = '{"countdowns": [{"id": 1,'
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'metadata.json'), broken)

  const { app, window } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(window.getByText(/图表、倒数日等配置无法读取/)).toBeVisible()
    expect(await fs.readFile(path.join(sandbox.dataDir, 'metadata.json'), 'utf8')).toBe(broken)
  } finally {
    await app.close()
  }
})

test('a first run still creates the default sections', async ({ sandbox }) => {
  const { app, window } = await launchApp(sandbox)
  try {
    await expect.poll(async () => fs.readFile(path.join(sandbox.dataDir, 'sections.json'), 'utf8').catch(() => ''), {
      timeout: 10_000
    }).toContain('diary')
    await expect(window.getByText(/版块配置文件无法读取/)).toHaveCount(0)
  } finally {
    await app.close()
  }
})

test('notes stay visible when their index file is corrupt or missing', async ({ sandbox }) => {
  const notesDir = path.join(sandbox.dataDir, 'notes')
  await fs.mkdir(notesDir, { recursive: true })
  const note = (id, title, updatedAt) => JSON.stringify({
    id,
    title,
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${title}的正文` }] }] },
    createdAt: updatedAt,
    updatedAt,
    pinned: false,
    archived: false,
    fontSize: 14,
    dateLink: null
  })
  await fs.writeFile(path.join(notesDir, 'n1.json'), note('n1', '第一条便签', '2026-05-01T08:00:00.000Z'))
  await fs.writeFile(path.join(notesDir, 'n2.json'), note('n2', '第二条便签', '2026-05-02T08:00:00.000Z'))
  await fs.writeFile(path.join(notesDir, 'index.json'), '[{"id": "n1", "title"')

  const { app, window } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '便签' }).click()
    await expect(window.locator('.notes-list-item')).toHaveCount(2)
    await expect(window.locator('.notes-list-item').first()).toContainText('第二条便签')
    // Nothing was rewritten just by looking.
    expect(await fs.readFile(path.join(notesDir, 'index.json'), 'utf8')).toBe('[{"id": "n1", "title"')
  } finally {
    await app.close()
  }
})
