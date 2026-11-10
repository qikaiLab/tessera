import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const EDITOR = '.sections-grid .ProseMirror'

async function openEditor(window) {
  await window.evaluate(() => window.api.config.set('onboardingDone', true))
  await window.reload()
  await window.waitForSelector('.sidebar')
  const editor = window.locator(EDITOR).first()
  await editor.click()
  return editor
}

// Nothing may really open during a test: the main process only records what it was asked to do.
async function recordShellCalls(app, pickedPath = null) {
  await app.evaluate(({ shell, dialog }, picked) => {
    globalThis.__shellCalls = []
    shell.openPath = async (target) => { globalThis.__shellCalls.push(['open', target]); return '' }
    shell.showItemInFolder = (target) => { globalThis.__shellCalls.push(['reveal', target]) }
    shell.openExternal = async (target) => { globalThis.__shellCalls.push(['external', target]) }
    dialog.showOpenDialog = async () => (picked ? { canceled: false, filePaths: [picked] } : { canceled: true, filePaths: [] })
  }, pickedPath)
}

const shellCalls = app => app.evaluate(() => globalThis.__shellCalls)

test('a typed path becomes a file link that opens photos and only reveals programs', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await fs.mkdir(sandbox.root, { recursive: true })
    const photo = path.join(sandbox.root, 'photo.jpg')
    const program = path.join(sandbox.root, 'tool.exe')
    await fs.writeFile(photo, 'x')
    await fs.writeFile(program, 'x')
    await recordShellCalls(app)
    const editor = await openEditor(window)

    await window.keyboard.type(`[照片](<${photo}>)`)
    await window.keyboard.type(' ')
    await window.keyboard.type(`[程序](<${program}>)`)
    await window.keyboard.type(' ')
    await window.keyboard.type('[丢失](<C:\\no-such-folder-mototrace\\gone.jpg>)')
    await window.keyboard.type(' ')
    // A network share is never turned into a link.
    await window.keyboard.type('[共享](<\\\\server\\share\\a.jpg>)')

    const links = editor.locator('a[href^="file:///"]')
    await expect(links).toHaveCount(3)
    await expect(links.nth(0)).toHaveText('照片')

    await links.nth(0).click()
    await expect.poll(() => shellCalls(app)).toEqual([['open', photo]])

    await links.nth(1).click()
    await expect.poll(() => shellCalls(app)).toEqual([['open', photo], ['reveal', program]])
    await expect(window.locator('.toast, [class*="toast"]').filter({ hasText: '不会被直接打开' }).first()).toBeVisible()

    await links.nth(2).click()
    await expect(window.locator('.toast, [class*="toast"]').filter({ hasText: '找不到' }).first()).toBeVisible()
    expect((await shellCalls(app)).length).toBe(2)

    // The window itself never navigated away from the app.
    await expect(editor).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the slash menu links a chosen file or folder', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await fs.mkdir(sandbox.root, { recursive: true })
    const photo = path.join(sandbox.root, '摩托 2026.png')
    await fs.writeFile(photo, 'x')
    await recordShellCalls(app, photo)
    const editor = await openEditor(window)

    await window.keyboard.type('/本地文件链接')
    await window.keyboard.press('Enter')
    const link = editor.locator('a[href^="file:///"]')
    await expect(link).toHaveCount(1)
    await expect(link).toHaveText('摩托 2026.png')

    await link.click()
    await expect.poll(() => shellCalls(app)).toEqual([['open', photo]])

    // Typing on goes on as plain text.
    await window.keyboard.type('后面的字')
    await expect(link).toHaveText('摩托 2026.png')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('cancelling the file picker leaves the note as it was', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await recordShellCalls(app, null)
    const editor = await openEditor(window)

    await window.keyboard.type('前文 /本地文件链接')
    await window.keyboard.press('Enter')
    await expect(editor.locator('a')).toHaveCount(0)
    await expect(editor.locator('p').first()).toHaveText('前文')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a pasted Markdown link to a local path is kept, a network one is dropped', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const editor = await openEditor(window)
    await window.evaluate(() => {
      const data = new DataTransfer()
      data.setData('text/plain', '[本地](C:\\Photos\\a.jpg) 和 [共享](\\\\server\\share\\a.jpg)')
      document.querySelector('.sections-grid .ProseMirror')
        .dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await expect(editor.locator('a')).toHaveCount(1)
    await expect(editor.locator('a')).toHaveAttribute('href', 'file:///C:/Photos/a.jpg')
    await expect(editor.locator('p').first()).toContainText('共享')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
