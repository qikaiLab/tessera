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

// Dispatches a paste the way the browser does, with the given clipboard flavours.
function paste(window, { text, html = '' }) {
  return window.evaluate(({ text, html }) => {
    const target = document.querySelector('.sections-grid .ProseMirror')
    const data = new DataTransfer()
    data.setData('text/plain', text)
    if (html) data.setData('text/html', html)
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, { text, html })
}

test('typing [text](address) becomes a link, and images stay as typed', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const editor = await openEditor(window)

    await window.keyboard.type('看 [文档](https://example.com/a) 后继续')
    const link = editor.locator('a[href="https://example.com/a"]')
    await expect(link).toHaveText('文档')
    // Typing after the link is ordinary text again.
    await expect(editor.locator('p').first()).toHaveText('看 文档 后继续')
    await expect(editor.locator('a')).toHaveCount(1)

    await window.keyboard.press('Enter')
    await window.keyboard.type('![图](https://example.com/p.png)')
    await expect(editor.locator('a')).toHaveCount(1)
    await expect(editor.locator('p').nth(1)).toHaveText('![图](https://example.com/p.png)')

    await window.keyboard.press('Enter')
    await window.keyboard.type('[脚本](javascript:alert(1))')
    await expect(editor.locator('a')).toHaveCount(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the slash menu inserts a table that Tab moves through', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const editor = await openEditor(window)

    await window.keyboard.type('/表格')
    await window.keyboard.press('Enter')
    await expect(editor.locator('table')).toHaveCount(1)
    await expect(editor.locator('tr')).toHaveCount(3)
    await expect(editor.locator('th')).toHaveCount(3)
    await expect(editor.locator('td')).toHaveCount(6)

    await window.keyboard.type('项目')
    await window.keyboard.press('Tab')
    await window.keyboard.type('数量')
    await expect(editor.locator('th').nth(0)).toHaveText('项目')
    await expect(editor.locator('th').nth(1)).toHaveText('数量')

    // Tab out of the last cell adds a row instead of leaving the table.
    for (let i = 0; i < 8; i += 1) await window.keyboard.press('Tab')
    await expect(editor.locator('tr')).toHaveCount(4)

    // Ctrl+Enter leaves the table for a fresh paragraph below it.
    await window.keyboard.press('Control+Enter')
    await window.keyboard.type('表格之后')
    await expect(editor.locator('p', { hasText: '表格之后' })).toHaveCount(1)
    await expect(editor.locator('table p', { hasText: '表格之后' })).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('pasting Markdown renders it, and plain or rich pastes are left alone', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const editor = await openEditor(window)

    await paste(window, {
      text: '# 保养记录\n\n今天 **换了机油**，见 [说明](https://example.com)\n\n- [x] 机油\n- [ ] 滤芯\n\n| 项目 | 价格 |\n| --- | --- |\n| 机油 | 80 |'
    })
    await expect(editor.locator('h1')).toHaveText('保养记录')
    await expect(editor.locator('strong')).toHaveText('换了机油')
    await expect(editor.locator('a[href="https://example.com"]')).toHaveText('说明')
    await expect(editor.locator('ul[data-type="taskList"] > li')).toHaveCount(2)
    await expect(editor.locator('table th')).toHaveText(['项目', '价格'])
    await expect(editor.locator('table td')).toHaveText(['机油', '80'])

    // One undo takes the whole paste back.
    await window.keyboard.press('Control+z')
    await expect(editor.locator('h1, table, ul')).toHaveCount(0)

    // Ordinary text is pasted as it is.
    await paste(window, { text: '骑行 80 km，路线 a_b_c，没有 Markdown' })
    await expect(editor.locator('strong, em')).toHaveCount(0)
    await expect(editor.locator('p').first()).toContainText('骑行 80 km，路线 a_b_c')

    // So is anything that arrives as real rich text.
    await paste(window, { text: '# 不转换\n- a\n- b', html: '<h2>网页标题</h2><ul><li>a</li></ul>' })
    await expect(editor.locator('h1')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('paste as plain text keeps Markdown source as typed', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const editor = await openEditor(window)

    await window.keyboard.down('Shift')
    await paste(window, { text: '# 原样保留\n- a\n- b' })
    await window.keyboard.up('Shift')
    await expect(editor.locator('h1, ul')).toHaveCount(0)
    await expect(editor.locator('p').first()).toContainText('# 原样保留')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
