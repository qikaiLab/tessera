const fs = require('fs')
const fsp = fs.promises
const path = require('path')

const MAX_BACKGROUND_BYTES = 16 * 1024 * 1024
const BACKGROUND_DIRECTORY = 'appearance'
const BACKGROUND_BASENAME = 'frosted-glass-background'
const IMAGE_TYPES = Object.freeze([
  Object.freeze({ extension: '.png', mimeType: 'image/png' }),
  Object.freeze({ extension: '.jpg', mimeType: 'image/jpeg' }),
  Object.freeze({ extension: '.webp', mimeType: 'image/webp' })
])

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return IMAGE_TYPES[0]
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return IMAGE_TYPES[1]
  }

  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return IMAGE_TYPES[2]
  }

  return null
}

function getBackgroundDirectory(userDataDirectory) {
  return path.join(userDataDirectory, BACKGROUND_DIRECTORY)
}

function getManagedBackgroundPaths(userDataDirectory) {
  const directory = getBackgroundDirectory(userDataDirectory)
  return IMAGE_TYPES.map(({ extension }) => path.join(directory, `${BACKGROUND_BASENAME}${extension}`))
}

async function removeManagedBackgrounds(userDataDirectory, keepPath = null) {
  const candidates = getManagedBackgroundPaths(userDataDirectory)
  await Promise.all(candidates.map(async candidate => {
    if (keepPath && path.resolve(candidate) === path.resolve(keepPath)) return
    try {
      await fsp.unlink(candidate)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }))
}

async function importBackgroundImage(sourcePath, userDataDirectory) {
  const sourceStat = await fsp.stat(sourcePath)
  if (!sourceStat.isFile()) throw new Error('请选择有效的图片文件')
  if (sourceStat.size > MAX_BACKGROUND_BYTES) throw new Error('背景图片不能超过 16 MB')

  const source = await fsp.readFile(sourcePath)
  const imageType = detectImageType(source)
  if (!imageType) throw new Error('仅支持 PNG、JPEG 或 WebP 图片')

  const directory = getBackgroundDirectory(userDataDirectory)
  const targetPath = path.join(directory, `${BACKGROUND_BASENAME}${imageType.extension}`)
  const temporaryPath = `${targetPath}.tmp`
  await fsp.mkdir(directory, { recursive: true })
  await fsp.writeFile(temporaryPath, source)
  await removeManagedBackgrounds(userDataDirectory, targetPath)
  try {
    await fsp.unlink(targetPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await fsp.rename(temporaryPath, targetPath)

  return {
    path: targetPath,
    mimeType: imageType.mimeType,
    size: source.length,
    dataUrl: `data:${imageType.mimeType};base64,${source.toString('base64')}`
  }
}

async function readManagedBackground(userDataDirectory) {
  for (const candidate of getManagedBackgroundPaths(userDataDirectory)) {
    try {
      const data = await fsp.readFile(candidate)
      const imageType = detectImageType(data)
      if (!imageType || data.length > MAX_BACKGROUND_BYTES) continue
      return {
        path: candidate,
        mimeType: imageType.mimeType,
        size: data.length,
        dataUrl: `data:${imageType.mimeType};base64,${data.toString('base64')}`
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  return null
}

export {
  MAX_BACKGROUND_BYTES,
  detectImageType,
  getManagedBackgroundPaths,
  importBackgroundImage,
  readManagedBackground,
  removeManagedBackgrounds
}
