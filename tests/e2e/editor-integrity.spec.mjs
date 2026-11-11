import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const EDITOR = '.sections-grid .ProseMirror'
const pad = value => String(value).padStart(2, '0')

function todayFile(sandbox) {
  const now = new Date()
  return path.join(sandbox.dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(now.getDate())}.json`)
}

async function seedDiary(sandbox, value) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }
  ]))
  if (value === undefined) return
  const file = todayFile(sandbox)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ diary: { value, updatedAt: new Date().toISOString() } }))
}

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

test('a slash inside a line is plain text and Enter still starts a new line', async ({ sandbox }) => {
  await seedDiary(sandbox)
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator(EDITOR).first().click()
    await window.keyboard.type('完成 3/3')
    await expect(window.locator('.slash-menu')).toHaveCount(0)
    await window.keyboard.press('Enter')
    await window.keyboard.type('第二行')
    const paragraphs = window.locator(`${EDITOR} p`)
    await expect(paragraphs).toHaveCount(2)
    await expect(paragraphs.first()).toHaveText('完成 3/3')
    await expect(window.locator(`${EDITOR} h1, ${EDITOR} h2, ${EDITOR} h3`)).toHaveCount(0)

    // Still opens where it should: after a space.
    await window.keyboard.type(' /')
    await expect(window.locator('.slash-menu')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a stored document with formats this version does not know keeps its text and is not overwritten by opening it', async ({ sandbox }) => {
  const original = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'callout', content: [{ type: 'paragraph', content: [{ type: 'text', text: '来自新版本的提示框' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '带未知标记的文字', marks: [{ type: 'sparkle' }] }] }
    ]
  })
  await seedDiary(sandbox, original)
  const file = todayFile(sandbox)
  const before = await fs.readFile(file, 'utf8')

  const { app, window } = await openApp(sandbox)
  try {
    const editor = window.locator(EDITOR).first()
    await expect(editor).toContainText('来自新版本的提示框')
    await expect(editor).toContainText('带未知标记的文字')
    await expect(window.getByText(/当前版本不支持的格式/)).toBeVisible()
    await window.waitForTimeout(1200)
    expect(await fs.readFile(file, 'utf8')).toBe(before)

    // Only the user's own edit rewrites the file, and by then the text is all still there.
    await editor.click()
    await window.keyboard.press('Control+End')
    await window.keyboard.type('，再补一句')
    await expect.poll(() => fs.readFile(file, 'utf8'), { timeout: 10_000 }).toContain('再补一句')
    const saved = await fs.readFile(file, 'utf8')
    expect(saved).toContain('来自新版本的提示框')
    expect(saved).toContain('带未知标记的文字')
  } finally {
    await app.close()
  }
})

test('clicking into a document that ends in a list does not rewrite it, repaired or not', async ({ sandbox }) => {
  // Ends in a list, so the editor wants an empty paragraph after it once it is focused: that follow-up
  // is not an edit by the user and must not write the file (here the document was also repaired).
  const original = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '带未知标记', marks: [{ type: 'sparkle' }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '清单项' }] }] }] }
    ]
  })
  await seedDiary(sandbox, original)
  const file = todayFile(sandbox)
  const before = await fs.readFile(file, 'utf8')

  const { app, window } = await openApp(sandbox)
  try {
    const editor = window.locator(EDITOR).first()
    await expect(editor).toContainText('清单项')
    await expect(window.getByText(/当前版本不支持的格式/)).toHaveCount(1)
    await editor.click()
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(1500)
    expect(await fs.readFile(file, 'utf8')).toBe(before)

    await window.keyboard.type('追加')
    await expect.poll(() => fs.readFile(file, 'utf8'), { timeout: 10_000 }).toContain('追加')
    expect(await fs.readFile(file, 'utf8')).toContain('带未知标记')
  } finally {
    await app.close()
  }
})

test('a legacy plain-text day with blank lines is opened once, with one notice and no second load', async ({ sandbox }) => {
  // Not a valid rich-text document: shown as paragraphs, blank lines included.
  await seedDiary(sandbox, '{"unfinished": 第一段\n\n第二段')
  const { app, window } = await openApp(sandbox)
  try {
    await expect(window.locator(EDITOR).first()).toContainText('第二段')
    await window.waitForTimeout(800)
    expect(await window.getByText(/当前版本不支持的格式/).count()).toBeLessThanOrEqual(1)
  } finally {
    await app.close()
  }
})

test('legacy plain text that happens to be valid JSON is shown, not replaced by an empty card', async ({ sandbox }) => {
  await seedDiary(sandbox, '2024')
  const { app, window, problems } = await openApp(sandbox)
  try {
    await expect(window.locator(EDITOR).first()).toHaveText('2024')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('pasting from the context menu keeps the lines as separate paragraphs', async ({ sandbox }) => {
  await seedDiary(sandbox)
  const { app, window, problems } = await openApp(sandbox)
  try {
    await app.evaluate(({ clipboard }) => clipboard.writeText('第一行\r\n第二行\n第三行'))
    const editor = window.locator(EDITOR).first()
    await editor.click()
    await editor.click({ button: 'right' })
    await window.locator('.app-context-menu').getByText('粘贴').click()
    const paragraphs = window.locator(`${EDITOR} p`)
    await expect(paragraphs).toHaveCount(3)
    await expect(paragraphs.nth(0)).toHaveText('第一行')
    await expect(paragraphs.nth(2)).toHaveText('第三行')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Esc closes the slash menu without also leaving fullscreen', async ({ sandbox }) => {
  await seedDiary(sandbox)
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(600)
    await window.locator('.fullscreen-btn').first().click()
    const shell = window.locator('.tiptap-shell.tiptap-fullscreen')
    await expect(shell).toBeVisible()
    await window.locator(EDITOR).first().click()
    await window.keyboard.type('/')
    await expect(window.locator('.slash-menu')).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(window.locator('.slash-menu')).toHaveCount(0)
    await expect(shell).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
