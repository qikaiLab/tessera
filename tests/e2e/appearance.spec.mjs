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
  await window.getByRole('button', { name: /导入我的图片/ }).click()
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

async function openFrostedSettings(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(async () => {
    await window.api.config.set('interfaceStyle', 'frosted-glass')
    await window.api.config.set('onboardingDone', true)
  })
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '设置' }).click()
  return launched
}

const accentHue = window =>
  window.evaluate(() => document.documentElement.style.getPropertyValue('--frosted-accent-h'))
const savedWallpaper = window => window.evaluate(async () => (await window.api.config.get()).frostedWallpaper)

test('picks a bundled frosted-glass wallpaper in place, adapts the glass colours and keeps it after a restart', async ({ sandbox }) => {
  const { app, window, problems } = await openFrostedSettings(sandbox)
  try {
    const html = window.locator('html')
    const choice = name => window.getByRole('radio', { name })
    await expect(choice('系统默认')).toHaveAttribute('aria-checked', 'true')
    await expect(html).toHaveAttribute('data-frosted-background', 'default')
    const defaultBackground = await shellBackground(window)
    const defaultHue = await accentHue(window)

    for (const [name, id] of [['暮光', 'dusk'], ['森林', 'forest'], ['海洋', 'ocean']]) {
      await choice(name).click()
      await expect(html).toHaveAttribute('data-frosted-background', id)
      await expect(choice(name)).toHaveAttribute('aria-checked', 'true')
      await expect(choice('系统默认')).toHaveAttribute('aria-checked', 'false')
      await expect.poll(() => shellBackground(window)).not.toBe(defaultBackground)
      expect(await savedWallpaper(window)).toBe(id)
    }
    // The glass follows the wallpaper: the ocean picture is blue-green, the default one is not the same blue.
    expect(await accentHue(window)).not.toBe(defaultHue)

    await choice('森林').click()
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(html).toHaveAttribute('data-frosted-background', 'forest')
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await expect(choice('森林')).toHaveAttribute('aria-checked', 'true')

    await choice('系统默认').click()
    await expect(html).toHaveAttribute('data-frosted-background', 'default')
    expect(await shellBackground(window)).toBe(defaultBackground)
    expect(await accentHue(window)).toBe(defaultHue)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps an imported picture while a bundled wallpaper shows, and falls back to the default when it is removed', async ({ sandbox }) => {
  await fs.mkdir(sandbox.root, { recursive: true })
  const imagePath = path.join(sandbox.root, 'small-background.png')
  await fs.writeFile(imagePath, createNoisePng(64, 48))

  const { app, window, problems } = await openFrostedSettings(sandbox)
  try {
    const html = window.locator('html')
    await importBackground(window, app, imagePath)
    await expect(window.getByRole('radio', { name: '我的图片' })).toHaveAttribute('aria-checked', 'true')
    expect(await savedWallpaper(window)).toBe('custom')

    // Choosing a bundled wallpaper does not throw the picture away.
    await window.getByRole('radio', { name: '海洋' }).click()
    await expect(html).toHaveAttribute('data-frosted-background', 'ocean')
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(html).toHaveAttribute('data-frosted-background', 'ocean')
    await window.locator('.nav-item', { hasText: '设置' }).click()
    await window.getByRole('radio', { name: '我的图片' }).click()
    await expect(html).toHaveAttribute('data-frosted-background', 'custom')

    // Removing the picture that is showing returns to the default wallpaper.
    await window.getByRole('button', { name: '移除图片' }).click()
    await expect(html).toHaveAttribute('data-frosted-background', 'default')
    await expect(window.getByRole('radio', { name: '我的图片' })).toHaveCount(0)
    await expect(window.getByRole('button', { name: /导入我的图片/ })).toBeVisible()
    expect(await savedWallpaper(window)).toBe('default')

    // Removing it while a bundled wallpaper shows leaves that wallpaper alone.
    await importBackground(window, app, imagePath)
    await window.getByRole('radio', { name: '暮光' }).click()
    await window.getByRole('button', { name: '移除图片' }).click()
    await expect(html).toHaveAttribute('data-frosted-background', 'dusk')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('an imported picture saved before wallpapers were selectable keeps showing after the update', async ({ sandbox }) => {
  await fs.mkdir(sandbox.root, { recursive: true })
  const imagePath = path.join(sandbox.root, 'older-background.png')
  await fs.writeFile(imagePath, createNoisePng(64, 48))

  const { app, window, problems } = await openFrostedSettings(sandbox)
  try {
    await importBackground(window, app, imagePath)
    // What an older version left behind: the picture, and no saved wallpaper choice.
    await window.evaluate(() => window.api.config.set('frostedWallpaper', undefined))
    expect(await savedWallpaper(window)).toBeUndefined()
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(window.locator('html')).toHaveAttribute('data-frosted-background', 'custom')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
