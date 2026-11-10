import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')
const doc = text => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

function todayFile(sandbox) {
  const now = new Date()
  return path.join(sandbox.dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(now.getDate())}.json`)
}

async function seedSections(sandbox) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }
  ]))
}

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

async function readToday(sandbox) {
  try {
    return JSON.parse(await fs.readFile(todayFile(sandbox), 'utf8'))
  } catch {
    return null
  }
}

test('an edit made just before leaving the record page still reaches the file', async ({ sandbox }) => {
  await seedSections(sandbox)
  const { app, window, problems } = await openApp(sandbox)
  try {
    const editor = window.locator('.sections-grid .ProseMirror').first()
    await editor.click()
    await window.keyboard.type('刚写完就切走')
    // Well inside the save delay: leaving the page used to drop what was still waiting to be saved.
    await window.locator('.nav-item', { hasText: '时间线' }).click()
    await expect.poll(async () => JSON.stringify(await readToday(sandbox)), { timeout: 10_000 }).toContain('刚写完就切走')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a day file that cannot be read is shown as an error and is never written over', async ({ sandbox }) => {
  await seedSections(sandbox)
  const file = todayFile(sandbox)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const broken = '{"diary": {"value": "{\\"type\\":'
  await fs.writeFile(file, broken)

  const { app, window } = await openApp(sandbox)
  try {
    const alert = window.getByRole('alert').filter({ hasText: '这天的记录暂时无法读取' })
    await expect(alert).toBeVisible()
    // Nothing to type into, so nothing can be saved over the damaged file.
    await expect(window.locator('.sections-grid .ProseMirror')).toHaveCount(0)
    await window.waitForTimeout(1500)
    expect(await fs.readFile(file, 'utf8')).toBe(broken)

    // Once the file is readable again, retrying opens the day normally.
    await fs.writeFile(file, JSON.stringify({ diary: { value: doc('修复之后的内容'), updatedAt: new Date().toISOString() } }))
    await alert.getByRole('button', { name: '重试读取' }).click()
    await expect(window.locator('.sections-grid .ProseMirror').first()).toContainText('修复之后的内容')
  } finally {
    await app.close()
  }
})

test('reload and developer-tools shortcuts are disabled so a reload cannot discard unsaved edits', async ({ sandbox }) => {
  await seedSections(sandbox)
  const { app } = await openApp(sandbox)
  try {
    // Feeds the window the same input event the keyboard produces and reports whether the app
    // swallowed it (a synthetic key press would skip the app's handler, so it proves nothing).
    const swallowed = input => app.evaluate(({ BrowserWindow }, keyInput) => {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
      BrowserWindow.getAllWindows()[0].webContents.emit('before-input-event', event, keyInput)
      return event.defaultPrevented
    }, { type: 'keyDown', control: false, meta: false, shift: false, alt: false, ...input })

    expect(await swallowed({ key: 'F5' })).toBe(true)
    expect(await swallowed({ key: 'r', control: true })).toBe(true)
    expect(await swallowed({ key: 'R', control: true, shift: true })).toBe(true)
    expect(await swallowed({ key: 'F12' })).toBe(true)
    expect(await swallowed({ key: 'I', control: true, shift: true })).toBe(true)
    // Everyday editing shortcuts are untouched.
    expect(await swallowed({ key: 'i', control: true })).toBe(false)
    expect(await swallowed({ key: 's', control: true })).toBe(false)
  } finally {
    await app.close()
  }
})
