import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

function todayString() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

async function readIndex(sandbox) {
  try {
    return JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'notes', 'index.json'), 'utf8'))
  } catch {
    return []
  }
}

async function openDrawer(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.waitForTimeout(500)
  await launched.window.locator('.today-notes-toggle').first().click()
  await expect(launched.window.locator('.notes-drawer')).toBeVisible()
  return launched
}

test('the notes drawer creates, edits, duplicates and deletes notes for the day', async ({ sandbox }) => {
  const { app, window, problems } = await openDrawer(sandbox)
  try {
    const tabs = window.locator('.notes-drawer-tabs')
    await expect(window.locator('.notes-drawer-empty')).toBeVisible()

    // A note made in the "linked" tab belongs to today and opens for editing at once.
    await window.locator('.notes-drawer-new').click()
    const title = window.locator('.notes-drawer-title-input')
    await expect(title).toBeFocused()
    await title.fill('今天的想法')
    await window.locator('.notes-drawer-editor-body .ProseMirror').click()
    await window.keyboard.type('抽屉里写的内容')
    await expect.poll(async () => (await readIndex(sandbox))[0]?.title).toBe('今天的想法')
    expect((await readIndex(sandbox))[0].dateLink).toEqual({ type: 'single', start: todayString(), end: todayString() })

    // Folding the editor shut leaves the compact card; the note stays in the list.
    await window.locator('.notes-drawer-close-edit').click()
    await expect(window.locator('.notes-drawer-item')).toHaveCount(1)
    await expect(window.locator('.notes-drawer-card-text')).toContainText('抽屉里写的内容')
    await expect(window.locator('.notes-drawer-card.editing')).toHaveCount(0)

    // It is not pinned, so the "pinned" tab is empty; "latest" lists it again.
    await tabs.getByRole('button', { name: '置顶' }).click()
    await expect(window.locator('.notes-drawer-empty')).toBeVisible()
    await tabs.getByRole('button', { name: '最新' }).click()
    await expect(window.locator('.notes-drawer-item')).toHaveCount(1)

    // Duplicate from the context menu: the copy opens for editing.
    await window.locator('.notes-drawer-card').first().click({ button: 'right' })
    await window.getByRole('menuitem', { name: '新建副本' }).click()
    await expect(window.locator('.notes-drawer-item')).toHaveCount(2)
    await expect(window.locator('.notes-drawer-title-input')).toHaveValue('今天的想法 副本')

    // Deleting asks first.
    await window.locator('.notes-drawer-card.editing').click({ button: 'right', position: { x: 12, y: 8 } })
    await window.getByRole('menuitem', { name: '删除' }).click()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('确定要删除便签')
    await dialog.getByRole('button', { name: '删除', exact: true }).click()
    await expect(window.locator('.notes-drawer-item')).toHaveCount(1)
    await expect.poll(async () => (await readIndex(sandbox)).length).toBe(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the drawer remembers its tab and open note for the day within a session', async ({ sandbox }) => {
  const { app, window, problems } = await openDrawer(sandbox)
  try {
    await window.locator('.notes-drawer-new').click()
    await window.locator('.notes-drawer-title-input').fill('记住我')
    await expect.poll(async () => (await readIndex(sandbox))[0]?.title).toBe('记住我')

    // Close the drawer and open it again: the same note is still open.
    await window.locator('.today-notes-toggle').first().click()
    await expect(window.locator('.notes-drawer')).toHaveCount(0)
    await window.locator('.today-notes-toggle').first().click()
    await expect(window.locator('.notes-drawer-title-input')).toHaveValue('记住我')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
