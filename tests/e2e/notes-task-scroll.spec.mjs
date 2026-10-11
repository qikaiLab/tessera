import { test, expect, launchApp } from './fixtures.mjs'

// Clicking a to-do checkbox while the editor is not focused used to jump the editor back to
// the top and drop the caret at the start of the document.
test('toggling a to-do in an unfocused note keeps the scroll position', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '便签' }).click()
    await window.getByTitle('新建便签').click()

    // A new note puts the caret in its title; wait for that before moving to the body.
    await expect(window.locator('.notes-title-input')).toBeFocused()
    const editor = window.locator('.notes-editor-body .ProseMirror')
    await editor.click()
    await expect(editor).toBeFocused()
    for (let i = 1; i <= 40; i += 1) {
      await window.keyboard.type(`待办 ${i}`)
      if (i < 40) await window.keyboard.press('Enter')
    }
    await window.keyboard.press('Control+a')
    await window.locator('.bubble-toolbar.is-visible button[title="任务列表"]').click()
    await expect(editor.locator('ul[data-type="taskList"] > li')).toHaveCount(40)

    // Reopen the note from the list: a fresh editor that has never had focus, with its
    // selection at the very start of the document.
    await window.getByTitle('新建便签').click()
    await expect(window.locator('.notes-list-item')).toHaveCount(2)
    await window.locator('.notes-list-item', { hasText: '待办 1' }).click()
    await expect(window.locator('.notes-editor-body ul[data-type="taskList"] > li')).toHaveCount(40)
    await expect(editor).not.toBeFocused()
    const wrapper = window.locator('.notes-editor-body .tiptap-editor-wrapper')
    await wrapper.evaluate(el => { el.scrollTop = el.scrollHeight })
    const before = await wrapper.evaluate(el => el.scrollTop)
    expect(before).toBeGreaterThan(200)

    const box = window.locator('.notes-editor-body ul[data-type="taskList"] li input[type="checkbox"]').last()
    await box.scrollIntoViewIfNeeded()
    const scrolled = await wrapper.evaluate(el => el.scrollTop)
    await box.click()

    await expect(box).toBeChecked()
    const after = await wrapper.evaluate(el => el.scrollTop)
    expect(Math.abs(after - scrolled)).toBeLessThan(4)
    // The caret lands in the ticked item, not at the start of the document.
    await expect(editor.locator('li').last()).toContainText('待办 40')
    const caretText = await window.evaluate(() => window.getSelection()?.anchorNode?.textContent ?? '')
    expect(caretText).not.toContain('待办 1')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
