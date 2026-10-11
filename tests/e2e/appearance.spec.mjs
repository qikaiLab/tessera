import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { randomBytes } from 'node:crypto'
import { test, expect, launchApp } from './fixtures.mjs'

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const chunk = Buffer.alloc(body.length + 8)
  chunk.writeUInt32BE(data.length, 0)
  body.copy(chunk, 4)
  chunk.writeUInt32BE(zlib.crc32(body), body.length + 4)
  return chunk
}

// Random pixels barely compress, which gives a realistically large "photo".
function createNoisePng(width, height) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) randomBytes(width * 3).copy(raw, y * stride + 1)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 1 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

async function importBackground(window, app, imagePath) {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, imagePath)
  await window.locator('.nav-item', { hasText: '设置' }).click()
  await window.getByRole('button', { name: '导入图片' }).click()
  await expect(window.locator('html')).toHaveAttribute('data-frosted-background', 'custom')
}

const shellBackground = window =>
  window.evaluate(() => getComputedStyle(document.querySelector('.app-shell'), '::before').backgroundImage)

test('applies a large custom frosted-glass background to the app shell', async ({ sandbox }) => {
  const image = createNoisePng(1400, 1000)
  // Chromium rejects custom property values over 2 MB, base64 inflates by a third.
  expect(image.length).toBeGreaterThan(3 * 1024 * 1024)
  await fs.mkdir(sandbox.root, { recursive: true })
  const imagePath = path.join(sandbox.root, 'large-background.png')
  await fs.writeFile(imagePath, image)

  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(async () => {
      await window.api.config.set('interfaceStyle', 'frosted-glass')
      await window.api.config.set('onboardingDone', true)
    })
    await window.reload()
    await window.waitForSelector('.sidebar')

    const defaultBackground = await shellBackground(window)
    await importBackground(window, app, imagePath)
    await expect.poll(() => shellBackground(window)).not.toBe(defaultBackground)
    expect(await shellBackground(window)).toContain('blob:')

    // The persisted image must also be applied again after a restart.
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(window.locator('html')).toHaveAttribute('data-frosted-background', 'custom')
    expect(await shellBackground(window)).toContain('blob:')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
