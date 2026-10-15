import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

async function seed(sandbox) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }
  ]))
  const date = new Date()
  const dayPath = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}.json`
  const file = path.join(sandbox.dataDir, ...dayPath.split('/'))
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ diary: { value: '备份我', updatedAt: new Date().toISOString() } }))
  await fs.mkdir(path.join(sandbox.dataDir, 'backups'), { recursive: true })
  // Old backups and the automatic history are not part of a new backup.
  await fs.writeFile(path.join(sandbox.dataDir, 'backups', 'old.json'), '{}')
  return dayPath
}

async function zipEntries(zipPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(zipPath))
  return Object.keys(zip.files).filter(name => !zip.files[name].dir).sort()
}

test('a local backup and an export both hold the data files, nothing else', async ({ sandbox }) => {
  const dayPath = await seed(sandbox)
  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('tab', { name: '数据与备份' }).click()

    // Local backup: written into backups/ and listed.
    await window.getByRole('button', { name: '立即备份到本地' }).click()
    await expect(window.locator('.backup-item')).toHaveCount(1)
    const backups = (await fs.readdir(path.join(sandbox.dataDir, 'backups'))).filter(name => name.endsWith('.zip'))
    expect(backups).toHaveLength(1)
    expect(backups[0]).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/)
    const expected = [dayPath, 'sections.json']
    const inBackup = await zipEntries(path.join(sandbox.dataDir, 'backups', backups[0]))
    expect(inBackup).toEqual(expect.arrayContaining(expected))
    expect(inBackup.some(name => name.startsWith('backups/'))).toBe(false)

    // Export: to the path chosen in the save dialog.
    const exportPath = path.join(sandbox.root, 'export.zip')
    await app.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: target })
    }, exportPath)
    await window.getByRole('button', { name: '导出 ZIP' }).click()
    await expect.poll(() => fs.access(exportPath).then(() => true, () => false)).toBe(true)
    expect(await zipEntries(exportPath)).toEqual(expect.arrayContaining(expected))
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
