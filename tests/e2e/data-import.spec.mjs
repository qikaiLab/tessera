import fs from 'node:fs/promises'
import JSZip from 'jszip'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const chart = (id, title) => ({
  id,
  title,
  type: 'bar',
  bindings: [],
  dateRange: '30',
  dateAxisMode: 'recorded',
  lineStyle: 'smooth',
  dateFrom: '',
  dateTo: ''
})

const readCharts = async sandbox => {
  const metadata = JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'metadata.json'), 'utf8'))
  return metadata.analytics.map(item => item.title)
}

test('importing an export refreshes the app state so the next save cannot undo it', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(
    path.join(sandbox.dataDir, 'metadata.json'),
    JSON.stringify({ countdowns: [], analytics: [chart('a', '图表甲'), chart('b', '图表乙')] })
  )
  const exportPath = path.join(sandbox.root, 'export.zip')

  const { app, window, problems } = await launchApp(sandbox)
  try {
    await app.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
    }, exportPath)
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')

    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('tab', { name: '数据与备份' }).click()
    await window.getByRole('button', { name: '导出 ZIP' }).click()
    await expect.poll(async () => (await fs.stat(exportPath).catch(() => ({ size: 0 }))).size).toBeGreaterThan(0)

    // Remove one chart after exporting.
    await window.locator('.nav-item', { hasText: '数据分析' }).click()
    await expect(window.locator('.analytics-card')).toHaveCount(2)
    await window.locator('.analytics-card').nth(1).getByTitle('删除').click()
    await window.locator('.modal').getByRole('button', { name: /确定删除/ }).click()
    await expect.poll(() => readCharts(sandbox), { timeout: 15_000 }).toEqual(['图表甲'])

    // Importing brings it back, after an explicit confirmation.
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('tab', { name: '数据与备份' }).click()
    await window.getByRole('button', { name: /导入 ZIP/ }).click()
    await window.locator('.modal').getByRole('button', { name: '继续导入' }).click()
    await expect(window.getByText(/导入成功/)).toBeVisible()
    await expect.poll(() => readCharts(sandbox)).toEqual(['图表甲', '图表乙'])

    // The app itself shows the imported charts and a later edit keeps them.
    await window.locator('.nav-item', { hasText: '数据分析' }).click()
    await expect(window.locator('.analytics-card')).toHaveCount(2)
    await window.locator('.analytics-card-title').first().fill('图表甲（改）')
    await expect.poll(() => readCharts(sandbox), { timeout: 15_000 }).toEqual(['图表甲（改）', '图表乙'])
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('cancelling the import confirmation leaves the data untouched', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(
    path.join(sandbox.dataDir, 'metadata.json'),
    JSON.stringify({ countdowns: [], analytics: [chart('a', '图表甲')] })
  )
  const exportPath = path.join(sandbox.root, 'export.zip')
  await fs.writeFile(exportPath, 'not a zip')

  const { app, window } = await launchApp(sandbox)
  try {
    await app.evaluate(({ dialog }, target) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
    }, exportPath)
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('tab', { name: '数据与备份' }).click()
    await window.getByRole('button', { name: /导入 ZIP/ }).click()
    await window.locator('.modal').getByRole('button', { name: '取消' }).click()
    await expect(window.locator('.modal')).toHaveCount(0)
    await expect(window.getByText(/解析失败|导入成功/)).toHaveCount(0)
    expect(await readCharts(sandbox)).toEqual(['图表甲'])
  } finally {
    await app.close()
  }
})

// A "backup" from elsewhere can be shaped to exhaust the memory of the app: a few kilobytes that
// inflate to hundreds of megabytes, or a file far larger than any real data. Both are refused with
// a clear message and the existing data stays as it was.
async function importRefused(sandbox, prepare, expectedMessage) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(
    path.join(sandbox.dataDir, 'metadata.json'),
    JSON.stringify({ countdowns: [], analytics: [chart('a', '图表甲')] })
  )
  const importPath = path.join(sandbox.root, 'hostile.zip')
  await prepare(importPath)

  const { app, window } = await launchApp(sandbox)
  try {
    await app.evaluate(({ dialog }, target) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
    }, importPath)
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('tab', { name: '数据与备份' }).click()
    await window.getByRole('button', { name: /导入 ZIP/ }).click()
    await window.locator('.modal').getByRole('button', { name: '继续导入' }).click()
    await expect(window.getByRole('alert').filter({ hasText: expectedMessage })).toBeVisible()
    await expect(window.getByRole('button', { name: /导入 ZIP/ })).toBeEnabled()
    expect(await readCharts(sandbox)).toEqual(['图表甲'])
    // Still alive and usable afterwards.
    await window.locator('.nav-item', { hasText: '数据分析' }).click()
    await expect(window.locator('.analytics-card')).toHaveCount(1)
  } finally {
    await app.close()
  }
}

test('importing a ZIP bomb is refused before it fills the memory', async ({ sandbox }) => {
  await importRefused(sandbox, async (target) => {
    const zip = new JSZip()
    // 48 MB of spaces deflates to a few dozen kilobytes.
    zip.file('2026/01/01.json', ' '.repeat(48 * 1024 * 1024), { compression: 'DEFLATE' })
    await fs.writeFile(target, await zip.generateAsync({ type: 'nodebuffer' }))
  }, /展开后超过 32 MB/)
})

test('importing a file far larger than any backup is refused without reading it', async ({ sandbox }) => {
  await importRefused(sandbox, async (target) => {
    const handle = await fs.open(target, 'w')
    await handle.truncate(130 * 1024 * 1024) // a sparse file: instant, no disk used
    await handle.close()
  }, /超过 128 MB/)
})
