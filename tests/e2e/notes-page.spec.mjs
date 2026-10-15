import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

async function openNotes(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '便签' }).click()
  await launched.window.waitForSelector('.notes-page')
  return launched
}

async function readIndex(sandbox) {
  try {
    return JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'notes', 'index.json'), 'utf8'))
  } catch {
    return []
  }
}

async function readNote(sandbox, id) {
  return JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'notes', `${id}.json`), 'utf8'))
}

async function newNote(window, title) {
  await window.locator('.notes-new-btn').click()
  const input = window.locator('.notes-title-input')
  await expect(input).toBeFocused()
  await input.fill(title)
}

test('notes can be written, pinned, archived, duplicated, searched and deleted', async ({ sandbox }) => {
  const { app, window, problems } = await openNotes(sandbox)
  try {
    await expect(window.locator('.notes-empty-editor')).toBeVisible()

    // A new note: title and text are saved to disk and to the index.
    await newNote(window, '买菜清单')
    await window.locator('.notes-editor-body .ProseMirror').click()
    await window.keyboard.type('牛奶 鸡蛋')
    await expect(window.locator('.notes-editor-meta')).toContainText('5 字')
    await expect.poll(async () => (await readIndex(sandbox)).map(note => note.title)).toEqual(['买菜清单'])
    const [{ id: firstId }] = await readIndex(sandbox)
    await expect.poll(async () => JSON.stringify((await readNote(sandbox, firstId)).content)).toContain('牛奶 鸡蛋')

    // A second note, then pin the first: pinned notes lead the list.
    await newNote(window, '第二条')
    await expect(window.locator('.notes-list-item')).toHaveCount(2)
    await window.locator('.notes-list-item', { hasText: '买菜清单' }).click()
    await expect(window.locator('.notes-title-input')).toHaveValue('买菜清单')
    await window.locator('.notes-editor-actions').getByRole('button', { name: '置顶', exact: true }).click()
    await expect(window.locator('.notes-list-item').first()).toContainText('买菜清单')
    await expect(window.locator('.notes-list-item').first().locator('.notes-pin-dot')).toBeVisible()

    // Archive the second note: it leaves the current list and shows under "归档".
    await window.locator('.notes-list-item', { hasText: '第二条' }).click()
    await expect(window.locator('.notes-title-input')).toHaveValue('第二条')
    await window.locator('.notes-editor-actions').getByRole('button', { name: '归档', exact: true }).click()
    await expect(window.locator('.notes-list-item')).toHaveCount(1)
    await window.locator('.notes-status-pill', { hasText: '归档' }).click()
    await expect(window.locator('.notes-list-item')).toContainText('第二条')
    await window.locator('.notes-status-pill', { hasText: '当前' }).click()

    // Duplicate from the list's context menu.
    await window.locator('.notes-list-item', { hasText: '买菜清单' }).click({ button: 'right' })
    await window.getByRole('menuitem', { name: '新建副本' }).click()
    await expect(window.locator('.notes-title-input')).toHaveValue('买菜清单 副本')
    await expect(window.locator('.notes-list-item')).toHaveCount(2)

    // Search by text and title.
    await window.getByPlaceholder('搜索便签').fill('鸡蛋')
    await expect(window.locator('.notes-list-item')).toHaveCount(2)
    await window.getByPlaceholder('搜索便签').fill('没有这个词')
    await expect(window.locator('.notes-empty-list')).toBeVisible()
    await window.locator('.notes-search-clear').click()
    await expect(window.locator('.notes-list-item')).toHaveCount(2)

    // Deleting asks first; cancelling keeps it, confirming removes it from the list and disk.
    await window.locator('.notes-editor-actions').getByRole('button', { name: '删除', exact: true }).click()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('确定要删除便签')
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(window.locator('.notes-list-item')).toHaveCount(2)
    await window.locator('.notes-editor-actions').getByRole('button', { name: '删除', exact: true }).click()
    await dialog.getByRole('button', { name: '删除', exact: true }).click()
    await expect(window.locator('.notes-list-item')).toHaveCount(1)
    await expect.poll(async () => (await readIndex(sandbox)).length).toBe(2)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a note can be linked to a day and found again by its date', async ({ sandbox }) => {
  const { app, window, problems } = await openNotes(sandbox)
  try {
    await newNote(window, '十月计划')
    await newNote(window, '没有日期')
    await window.locator('.notes-list-item', { hasText: '十月计划' }).click()
    await expect(window.locator('.notes-title-input')).toHaveValue('十月计划')

    await window.getByRole('button', { name: '未关联日期' }).click()
    const panel = window.locator('.notes-date-link-panel')
    await panel.getByRole('button', { name: '单日' }).click()
    await panel.locator('input[type="date"]').fill('2026-10-05')
    await panel.getByRole('button', { name: '保存' }).click()
    await expect(window.locator('.notes-date-link-btn')).toHaveText('10/05')
    await expect(window.locator('.notes-list-item', { hasText: '十月计划' }).locator('.notes-date-badge')).toHaveText('10/05')
    await expect.poll(async () => (await readIndex(sandbox)).find(note => note.title === '十月计划')?.dateLink)
      .toEqual({ type: 'single', start: '2026-10-05', end: '2026-10-05' })

    // The date filter: only linked notes, only unlinked notes, then everything again.
    await window.getByRole('button', { name: '日期筛选' }).click()
    await window.getByRole('option', { name: '有日期关联' }).click()
    await expect(window.locator('.notes-list-item')).toHaveCount(1)
    await expect(window.locator('.notes-list-item')).toContainText('十月计划')
    await window.getByRole('button', { name: '日期筛选' }).click()
    await window.getByRole('option', { name: '无日期关联' }).click()
    await expect(window.locator('.notes-list-item')).toContainText('没有日期')
    await window.locator('.notes-date-filter-clear').click()
    await expect(window.locator('.notes-list-item')).toHaveCount(2)

    // Clearing the link from the panel.
    await window.locator('.notes-list-item', { hasText: '十月计划' }).click()
    await expect(window.locator('.notes-title-input')).toHaveValue('十月计划')
    await window.locator('.notes-date-link-btn').click()
    await window.locator('.notes-date-link-panel').getByRole('button', { name: '清除' }).click()
    await expect(window.locator('.notes-date-link-btn')).toHaveText('未关联日期')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
