import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const STYLE_ROOT = path.resolve('src/renderer/src')

function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.name.endsWith('.css') ? [full] : []
  })
}

// Every local url(...) in a stylesheet is resolved against that stylesheet. A moved file whose
// paths were not adjusted silently drops its images (the build only warns), which once left the
// fullscreen editor of two themes without a background.
describe('stylesheet asset urls', () => {
  const references = cssFiles(STYLE_ROOT).flatMap(file => {
    const css = fs.readFileSync(file, 'utf8')
    return [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)]
      .map(match => match[2])
      .filter(target => !/^(data:|https?:|\/\/|#)/.test(target))
      .map(target => ({ file, target }))
  })

  it('finds the theme images, so this check is not vacuous', () => {
    expect(references.some(({ target }) => target.includes('linen-fullscreen-background'))).toBe(true)
    expect(references.some(({ target }) => target.includes('jade-fullscreen-background'))).toBe(true)
  })

  it('points every local url at a file that exists', () => {
    const missing = references
      .filter(({ file, target }) => !fs.existsSync(path.resolve(path.dirname(file), target.split(/[?#]/)[0])))
      .map(({ file, target }) => `${path.relative(STYLE_ROOT, file)} -> ${target}`)
    expect(missing).toEqual([])
  })
})
