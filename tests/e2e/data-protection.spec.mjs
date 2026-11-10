import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { test, expect, launchApp } from './fixtures.mjs'

const GOOD = JSON.stringify({ diary: { value: 'good', updatedAt: '2026-05-01T00:00:00.000Z' } })
const NEWER = JSON.stringify({ diary: { value: 'newer', updatedAt: '2026-05-02T00:00:00.000Z' } })

async function seed(sandbox, files) {
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(sandbox.dataDir, relative)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, content)
  }
}

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  // Without the reload the first-run guide would still be open over everything else.
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

const exists = file => fs.access(file).then(() => true, () => false)

// ─── Crash recovery ────────────────────────────────────────────────────────

test('crash recovery restores a complete temporary file and sets an incomplete one aside', async ({ sandbox }) => {
  const cutOff = NEWER.slice(0, 30)
  await seed(sandbox, {
    '2026/05/01.json': GOOD,
    '2026/05/01.json.tmp': NEWER,
    '2026/05/02.json': GOOD,
    '2026/05/02.json.tmp': cutOff
  })
  const { app, window, problems } = await openApp(sandbox)
  try {
    await expect(window.getByText('发现未保存的数据')).toBeVisible()
    await window.getByRole('button', { name: '恢复数据' }).click()
    await expect(window.getByText(/内容不完整/)).toBeVisible()

    const day = name => path.join(sandbox.dataDir, '2026/05', name)
    // The complete one replaced its file; the truncated one did not, and was not thrown away.
    expect(await fs.readFile(day('01.json'), 'utf8')).toBe(NEWER)
    expect(await fs.readFile(day('02.json'), 'utf8')).toBe(GOOD)
    expect(await fs.readFile(day('02.json.incomplete'), 'utf8')).toBe(cutOff)
    expect(await exists(day('01.json.tmp'))).toBe(false)
    expect(await exists(day('02.json.tmp'))).toBe(false)
    // Nothing is left to ask about on the next start.
    expect(await window.evaluate(() => window.api.fs.checkTmpFiles())).toEqual([])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('discarding temporary files removes only those files', async ({ sandbox }) => {
  await seed(sandbox, { '2026/05/01.json': GOOD, '2026/05/01.json.tmp': NEWER })
  const { app, window } = await openApp(sandbox)
  try {
    await window.getByRole('button', { name: '丢弃' }).click()
    await expect(window.getByText('已清理临时文件')).toBeVisible()
    expect(await exists(path.join(sandbox.dataDir, '2026/05/01.json.tmp'))).toBe(false)
    expect(await fs.readFile(path.join(sandbox.dataDir, '2026/05/01.json'), 'utf8')).toBe(GOOD)
  } finally {
    await app.close()
  }
})

// ─── What the renderer is not allowed to ask the main process for ──────────

test('the main process refuses to delete data files, or to read and write arbitrary paths', async ({ sandbox }) => {
  await seed(sandbox, { '2026/05/01.json': GOOD })
  const outside = path.join(sandbox.root, 'outside.zip')
  const secret = path.join(sandbox.root, 'secret.txt')
  await fs.writeFile(secret, 'private')
  const { app, window } = await openApp(sandbox)
  try {
    const dataFile = path.join(sandbox.dataDir, '2026/05/01.json')
    const results = await window.evaluate(async ([dataFilePath, outsidePath, secretPath]) => ({
      // Discard and recover are for .tmp files only; a real data file must survive both.
      discard: await window.api.fs.discardTmp(dataFilePath),
      recover: await window.api.fs.recoverTmp(dataFilePath),
      // Export and import only touch a path the user chose in a dialog.
      write: await window.api.export.writeFile(outsidePath, 'AAAA'),
      read: await window.api.import.readFile(secretPath),
      // Data files are addressed relative to the data directory and cannot leave it.
      escape: await window.api.fs.writeFile('../escaped.json', '{}')
    }), [dataFile, outside, secret])

    expect(results.discard.ok).toBe(false)
    expect(results.recover.ok).toBe(false)
    expect(results.write.ok).toBe(false)
    expect(results.read.ok).toBe(false)
    expect(results.escape.ok).toBe(false)
    expect(await exists(path.join(sandbox.root, 'escaped.json'))).toBe(false)
    expect(await fs.readFile(dataFile, 'utf8')).toBe(GOOD)
    expect(await exists(outside)).toBe(false)
  } finally {
    await app.close()
  }
})

// ─── Import ────────────────────────────────────────────────────────────────

test('an archive with a damaged file imports nothing at all', async ({ sandbox }) => {
  await seed(sandbox, { '2026/05/01.json': GOOD })
  const archive = path.join(sandbox.root, 'damaged.zip')
  const zip = new JSZip()
  zip.file('2026/05/01.json', NEWER)
  zip.file('2026/05/02.json', '{"diary": {"value": ')
  await fs.writeFile(archive, await zip.generateAsync({ type: 'nodebuffer' }))

  const { app, window, problems } = await openApp(sandbox)
  try {
    await app.evaluate(({ dialog }, target) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
    }, archive)
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('tab', { name: '数据与备份' }).click()
    await window.getByRole('button', { name: /导入 ZIP/ }).click()
    await window.locator('.modal').getByRole('button', { name: '继续导入' }).click()

    await expect(window.getByText(/未导入任何内容/)).toBeVisible()
    // Even the sound file of the archive was not written, and the broken one never appeared.
    expect(await fs.readFile(path.join(sandbox.dataDir, '2026/05/01.json'), 'utf8')).toBe(GOOD)
    expect(await exists(path.join(sandbox.dataDir, '2026/05/02.json'))).toBe(false)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

// ─── Rebuilding the index ──────────────────────────────────────────────────

test('rebuilding the index picks up a day file added outside the app', async ({ sandbox }) => {
  await seed(sandbox, { 'sections.json': JSON.stringify([{ id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }]) })
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.reload()
    await window.waitForSelector('.sidebar')
    const now = new Date()
    const pad = value => String(value).padStart(2, '0')
    // A day of the current month other than today, so the calendar shows it.
    const day = now.getDate() === 1 ? 2 : 1
    await seed(sandbox, {
      [`${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(day)}.json`]: GOOD
    })

    await window.locator('.nav-item', { hasText: '日历' }).click()
    const marked = () => window.locator('.cal-day.has-data:not(.other-month)').count()
    const before = await marked()

    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('tab', { name: '数据与备份' }).click()
    await window.getByRole('button', { name: '重建索引' }).click()
    await expect(window.getByText('刷新完成')).toBeVisible()

    await window.locator('.nav-item', { hasText: '日历' }).click()
    await expect.poll(marked).toBe(before + 1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

// ─── Recovery must not be overwritten by what was already on screen ────────

test('after a recovery the app reloads, shows the recovered text, and editing keeps it', async ({ sandbox }) => {
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  const todayFile = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}.json`
  const entry = text => JSON.stringify({
    diary: {
      value: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }),
      updatedAt: '2026-05-01T00:00:00.000Z'
    }
  })
  await seed(sandbox, {
    'sections.json': JSON.stringify([{ id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }]),
    [todayFile]: entry('old text on disk'),
    [`${todayFile}.tmp`]: entry('recovered text from the interrupted save')
  })
  const { app, window, problems } = await openApp(sandbox)
  try {
    const editor = window.locator('.sections-grid .ProseMirror').first()
    // The day was loaded before the prompt: it still shows the old text.
    await expect(editor).toContainText('old text on disk')
    await window.getByRole('button', { name: '恢复数据' }).click()
    await expect(window.getByText('软件需要重新载入')).toBeVisible()
    await window.getByRole('button', { name: '重新载入' }).click()

    await window.waitForSelector('.sidebar')
    await expect(editor).toContainText('recovered text from the interrupted save')
    await editor.click()
    await window.keyboard.press('End')
    await window.keyboard.type(' plus more')
    await expect.poll(async () => fs.readFile(path.join(sandbox.dataDir, todayFile), 'utf8')).toContain('plus more')
    const saved = await fs.readFile(path.join(sandbox.dataDir, todayFile), 'utf8')
    expect(saved).toContain('recovered text from the interrupted save')
    expect(saved).not.toContain('old text on disk')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

// ─── The backups folder is for backup ZIP files only ───────────────────────

test('backup calls refuse the automatic history and anything that is not a ZIP in backups', async ({ sandbox }) => {
  await seed(sandbox, { '2026/05/01.json': GOOD })
  const { app, window } = await openApp(sandbox)
  try {
    const historyIndex = path.join(sandbox.dataDir, 'backups', 'automatic', 'index.json')
    const results = await window.evaluate(async (paths) => ({
      history: await window.api.backup.writeZip(paths.history, 'AAAA'),
      readHistory: await window.api.backup.readZip(paths.history),
      notZip: await window.api.backup.writeZip(paths.notZip, 'AAAA'),
      nested: await window.api.backup.writeZip(paths.nested, 'AAAA'),
      upDir: await window.api.backup.writeZip(paths.upDir, 'AAAA')
    }), {
      history: historyIndex,
      notZip: path.join(sandbox.dataDir, 'backups', 'notes.json'),
      nested: path.join(sandbox.dataDir, 'backups', 'automatic', 'backup-x.zip'),
      upDir: path.join(sandbox.dataDir, '2026', 'backup-x.zip')
    })
    for (const [name, result] of Object.entries(results)) expect(result.ok, name).toBe(false)
    expect(await exists(path.join(sandbox.dataDir, 'backups', 'notes.json'))).toBe(false)
  } finally {
    await app.close()
  }
})
