import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectImageType,
  importBackgroundImage,
  readManagedBackground,
  removeManagedBackgrounds
} from '../src/main/appearanceBackground.js'

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function makeTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mototrace-background-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('managed appearance backgrounds', () => {
  it('detects supported image content rather than trusting the extension', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    expect(detectImageType(png)).toMatchObject({ extension: '.png', mimeType: 'image/png' })
    expect(detectImageType(Buffer.from('not an image'))).toBeNull()
  })

  it('copies a selected image into app-owned storage and restores it as a data URL', async () => {
    const root = makeTemporaryDirectory()
    const sourcePath = path.join(root, 'background.txt')
    const userDataDirectory = path.join(root, 'user-data')
    fs.writeFileSync(sourcePath, Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0
    ]))

    const imported = await importBackgroundImage(sourcePath, userDataDirectory)
    expect(imported.path).toBe(path.join(userDataDirectory, 'appearance', 'frosted-glass-background.png'))
    expect(imported.dataUrl).toMatch(/^data:image\/png;base64,/)

    const restored = await readManagedBackground(userDataDirectory)
    expect(restored).toMatchObject({ path: imported.path, dataUrl: imported.dataUrl })

    await removeManagedBackgrounds(userDataDirectory)
    expect(await readManagedBackground(userDataDirectory)).toBeNull()
  })

  it('rejects unsupported files before writing managed state', async () => {
    const root = makeTemporaryDirectory()
    const sourcePath = path.join(root, 'fake.png')
    fs.writeFileSync(sourcePath, 'plain text')
    await expect(importBackgroundImage(sourcePath, path.join(root, 'user-data')))
      .rejects.toThrow('PNG')
  })
})
