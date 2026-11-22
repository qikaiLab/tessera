import { test, expect, launchApp } from './fixtures.mjs'

async function openToday(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  // Wait out the page transition so clicks land on settled cards.
  await launched.window.waitForTimeout(600)
  return launched
}

const firstEditor = window => window.locator('.sections-grid .ProseMirror').first()

test('Ctrl+Enter leaves a quote, adding a paragraph below it', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    const editor = firstEditor(window)
    await editor.click()
    await window.keyboard.type('> 引用的话')
    await window.keyboard.press('Control+Enter')
    await window.keyboard.type('引用之后')
    await expect(editor.locator('blockquote')).toHaveText('引用的话')
    // The new paragraph sits right below the quote, outside it.
    await expect(editor.locator('blockquote + p')).toHaveText('引用之后')
    await expect(editor.locator('blockquote p')).toHaveCount(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Ctrl+Enter leaves a code block', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    const editor = firstEditor(window)
    await editor.click()
    await window.keyboard.type('``` ')
    await window.keyboard.type('let a = 1')
    await window.keyboard.press('Control+Enter')
    await window.keyboard.type('代码之后')
    await expect(editor.locator('pre')).toHaveText('let a = 1')
    await expect(editor.locator('pre + p')).toHaveText('代码之后')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Ctrl+Backslash clears the formatting of the selection', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    const editor = firstEditor(window)
    await editor.click()
    await window.keyboard.type('加粗文字')
    await window.keyboard.press('Shift+Home')
    // The editor learns about the selection asynchronously; format only once it has it.
    await expect(window.locator('.bubble-toolbar.is-visible')).toBeVisible()
    await window.keyboard.press('Control+b')
    await expect(editor.locator('strong')).toHaveText('加粗文字')
    await window.keyboard.press('Control+\\')
    await expect(editor.locator('strong')).toHaveCount(0)
    await expect(editor.locator('p', { hasText: '加粗文字' })).toHaveCount(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('clicking a link opens it outside the app, only for safe schemes', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    // Never open a real browser from a test: replace the main process's opener first.
    const stubbed = await app.evaluate(({ shell }) => {
      globalThis.__opened = []
      shell.openExternal = async (url) => { globalThis.__opened.push(url) }
      return shell.openExternal.toString().includes('__opened')
    })
    expect(stubbed).toBe(true)

    const editor = firstEditor(window)
    await editor.click()
    await window.keyboard.type('访问 https://example.com/page 看看 ')
    const link = editor.locator('a[href="https://example.com/page"]')
    await expect(link).toHaveCount(1)
    await link.click()
    await expect.poll(() => app.evaluate(() => globalThis.__opened)).toEqual(['https://example.com/page'])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the fullscreen bar counts characters and changes width and font size, and every way out works', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    const editor = firstEditor(window)
    await editor.click()
    await window.keyboard.type('一二三四五')

    await window.locator('.fullscreen-btn').first().click()
    const shell = window.locator('.tiptap-shell.tiptap-fullscreen')
    await expect(shell).toBeVisible()
    await expect(window.locator('body')).toHaveClass(/editor-fullscreen-active/)
    await expect(shell.locator('.tiptap-char-count')).toHaveText('5 字')

    // Font size: A+ / A− step by one within the editor's range.
    const label = shell.locator('.tiptap-font-label')
    const size = Number(await label.textContent())
    await shell.getByRole('button', { name: 'A+' }).click()
    await expect(label).toHaveText(String(size + 1))
    await shell.getByRole('button', { name: 'A−' }).click()
    await shell.getByRole('button', { name: 'A−' }).click()
    await expect(label).toHaveText(String(size - 1))

    // Width: the toggle flips between the standard column and the wide one.
    const wrapper = shell.locator('.tiptap-editor-wrapper')
    const standardWidth = await wrapper.evaluate(el => el.style.maxWidth)
    await shell.locator('.tiptap-width-toggle').click()
    await expect.poll(() => wrapper.evaluate(el => el.style.maxWidth)).not.toBe(standardWidth)
    await shell.locator('.tiptap-width-toggle').click()
    await expect.poll(() => wrapper.evaluate(el => el.style.maxWidth)).toBe(standardWidth)

    // Leave with the button, with Escape and with Ctrl+Shift+Enter.
    await window.locator('.fullscreen-exit-btn').click()
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toHaveCount(0)
    await expect(window.locator('body')).not.toHaveClass(/editor-fullscreen-active/)
    await expect(window.locator('body')).not.toHaveClass(/editor-fullscreen-leaving/)

    await window.locator('.fullscreen-btn').first().click()
    await expect(shell).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toHaveCount(0)

    await window.locator('.fullscreen-btn').first().click()
    await expect(shell).toBeVisible()
    await window.keyboard.press('Control+Shift+Enter')
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toHaveCount(0)
    await expect(window.locator('body')).not.toHaveClass(/editor-fullscreen/)

    // Whatever the exits did, the text is untouched.
    await expect(firstEditor(window)).toHaveText('一二三四五')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the format toolbar steps aside while the context menu is open, and returns when it closes', async ({ sandbox }) => {
  const { app, window, problems } = await openToday(sandbox)
  try {
    const editor = firstEditor(window)
    await editor.click()
    await window.keyboard.type('右键互斥')
    await window.keyboard.press('Shift+Home')
    const toolbar = window.locator('.bubble-toolbar.is-visible')
    await expect(toolbar).toBeVisible()

    // Right-click inside the selected text: only the menu is left on screen.
    await editor.locator('p').first().click({ button: 'right', position: { x: 20, y: 10 } })
    const menu = window.locator('.app-context-menu')
    await expect(menu).toBeVisible()
    await expect(toolbar).toHaveCount(0)
    // The menu is the topmost thing at its own centre.
    const onTop = await menu.evaluate(el => {
      const box = el.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return el.contains(hit)
    })
    expect(onTop).toBe(true)
    // Text behind the translucent menu is blurred, not just dimmed.
    expect(await menu.evaluate(el => getComputedStyle(el).backdropFilter)).toContain('blur(')

    // Closing the menu leaves the selection alone, so the toolbar comes back.
    await window.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(toolbar).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
