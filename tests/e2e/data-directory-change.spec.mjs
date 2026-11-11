import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const DAY = JSON.stringify({ diary: { value: 'keep me', updatedAt: '2026-05-01T00:00:00.000Z' } })

async function openDataSettings(sandbox) {
  await fs.mkdir(path.join(sandbox.dataDir, '2026', '05'), { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, '2026', '05', '01.json'), DAY)
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '设置' }).click()
  await launched.window.getByRole('tab', { name: '数据与备份' }).click()
  return launched
}

const pickFolder = (app, folder) => app.evaluate(({ dialog }, target) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
}, folder)

const readConfig = async sandbox => JSON.parse(await fs.readFile(path.join(sandbox.userDataDir, 'config.json'), 'utf8'))
const exists = file => fs.access(file).then(() => true, () => false)

test('changing the data folder only schedules a move: nothing is copied, switched or touched now', async ({ sandbox }) => {
  const target = path.join(sandbox.root, 'new-data')
  await fs.mkdir(target)
  const { app, window, problems } = await openDataSettings(sandbox)
  try {
    await pickFolder(app, target)
    await window.getByRole('button', { name: '更改目录' }).click()
    const dialog = window.locator('.modal')
    await expect(dialog).toContainText('移动数据目录')
    await expect(dialog).toContainText('不会被删除或改动')
    await expect(dialog).toContainText(/\d+ 个文件/)
    await dialog.getByRole('button', { name: '下次启动时复制' }).click()

    // Asked whether to close now: answer "later".
    await expect(window.locator('.modal')).toContainText('下次启动时生效')
    await window.locator('.modal').getByRole('button', { name: '稍后自己关闭' }).click()

    const pending = window.getByTestId('pending-data-dir')
    await expect(pending).toContainText(target)
    // The folder in use, its data and the target are exactly as before; only the request is saved.
    await expect(window.locator('.settings-row-value').first()).toContainText(sandbox.dataDir)
    expect(await fs.readFile(path.join(sandbox.dataDir, '2026', '05', '01.json'), 'utf8')).toBe(DAY)
    expect(await fs.readdir(target)).toEqual([])
    const config = await readConfig(sandbox)
    expect(config.pendingDataDirChange).toMatchObject({ from: sandbox.dataDir, to: target, copy: true })
    expect(config.dataDir).toBeUndefined()

    // The request can be withdrawn.
    await pending.getByRole('button', { name: '取消更改' }).click()
    await expect(pending).toHaveCount(0)
    expect((await readConfig(sandbox)).pendingDataDirChange).toBeUndefined()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('declining the confirmation schedules nothing', async ({ sandbox }) => {
  const target = path.join(sandbox.root, 'new-data')
  await fs.mkdir(target)
  const { app, window } = await openDataSettings(sandbox)
  try {
    await pickFolder(app, target)
    await window.getByRole('button', { name: '更改目录' }).click()
    await window.locator('.modal').getByRole('button', { name: '取消' }).click()
    await expect(window.getByTestId('pending-data-dir')).toHaveCount(0)
    expect((await readConfig(sandbox)).pendingDataDirChange).toBeUndefined()
  } finally {
    await app.close()
  }
})

test('folders that cannot take the data are refused with the reason, and nothing is scheduled', async ({ sandbox }) => {
  const foreign = path.join(sandbox.root, 'photos')
  await fs.mkdir(foreign)
  await fs.writeFile(path.join(foreign, 'holiday.jpg'), 'x')
  const { app, window } = await openDataSettings(sandbox)
  try {
    await pickFolder(app, foreign)
    await window.getByRole('button', { name: '更改目录' }).click()
    await expect(window.getByText(/已有其他文件/)).toBeVisible()
    await expect(window.locator('.modal')).toHaveCount(0)

    await pickFolder(app, path.join(sandbox.dataDir, '2026'))
    await window.getByRole('button', { name: '更改目录' }).click()
    await expect(window.getByText(/不能位于当前数据目录之内/)).toBeVisible()

    await pickFolder(app, sandbox.dataDir)
    await window.getByRole('button', { name: '更改目录' }).click()
    await expect(window.getByText(/就是当前正在使用的数据目录/)).toBeVisible()

    expect((await readConfig(sandbox)).pendingDataDirChange).toBeUndefined()
    expect(await fs.readdir(foreign)).toEqual(['holiday.jpg'])
  } finally {
    await app.close()
  }
})

test('a page cannot point the data somewhere itself', async ({ sandbox }) => {
  const stranger = path.join(sandbox.root, 'stranger')
  await fs.mkdir(stranger)
  const { app, window } = await openDataSettings(sandbox)
  try {
    const results = await window.evaluate(async (folder) => {
      const attempt = async action => { try { return await action() } catch (error) { return { thrown: error.message } } }
      return {
        // Neither the folder nor the pending move can be written as plain settings...
        dataDir: await attempt(() => window.api.config.set('dataDir', folder)),
        pending: await attempt(() => window.api.config.set('pendingDataDirChange', { from: '', to: folder, copy: true })),
        // ...and a move can only be scheduled for a folder just picked in the folder dialog.
        plan: await window.api.config.planDataDirChange(folder),
        schedule: await window.api.config.scheduleDataDirChange(folder, true)
      }
    }, stranger)
    expect(results.dataDir.thrown).toBeTruthy()
    expect(results.pending.thrown).toBeTruthy()
    expect(results.plan.ok).toBe(false)
    expect(results.schedule.ok).toBe(false)

    const config = await readConfig(sandbox)
    expect(config.dataDir).toBeUndefined()
    expect(config.pendingDataDirChange).toBeUndefined()
    expect(await exists(path.join(stranger, '.tessera-write-test'))).toBe(false)
  } finally {
    await app.close()
  }
})
