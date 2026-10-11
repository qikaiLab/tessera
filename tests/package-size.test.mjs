import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

describe('installer size guards', () => {
  it('ships only the built output instead of the whole project', () => {
    const files = packageJson.build.files
    expect(files).toEqual(expect.arrayContaining(['out/**/*', 'package.json']))
    // A catch-all pattern would again pack sources, tests, docs and logs into app.asar.
    expect(files).not.toContain('**/*')
    expect(files.some(pattern => /^(src|tests|docs|txt_docs|scripts)\b/.test(pattern))).toBe(false)
  })

  it('keeps renderer libraries out of the packaged node_modules', () => {
    // The renderer is bundled by Vite, so these must be devDependencies: electron-builder
    // copies every runtime dependency into the installer a second time otherwise.
    expect(Object.keys(packageJson.dependencies || {})).toEqual([])
  })

  it('drops unused Chromium locale packs', () => {
    expect(packageJson.build.electronLanguages).toEqual(expect.arrayContaining(['zh-CN', 'en-US']))
  })

  it('keeps bundled image assets small (use WebP instead of PNG photos)', () => {
    const oversized = listFiles('src/renderer/src/assets')
      .map(file => ({ file, bytes: fs.statSync(file).size }))
      .filter(({ bytes }) => bytes > 600 * 1024)
    expect(oversized).toEqual([])
  })
})
