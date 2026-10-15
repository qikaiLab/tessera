import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Pages other than the record page are loaded on demand, and so are their stylesheets. A
// keyframes rule defined in one of them is missing (the animation silently does nothing) for
// everything else until that page has been opened once.
const LAZY_PAGES = ['Timeline', 'Calendar', 'Analytics', 'Notes', 'Settings']
const root = path.resolve('src/renderer/src')

function cssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.name.endsWith('.css') ? [full] : []
  })
}

const scopeOf = (file) => {
  const relative = path.relative(root, file).split(path.sep).join('/')
  const page = LAZY_PAGES.find(name => relative.startsWith(`pages/${name}/`))
  return page || 'eager'
}

describe('keyframes and lazily loaded pages', () => {
  it('only lets a page use keyframes defined in its own stylesheets or in eagerly loaded ones', () => {
    const files = cssFiles(root).map(file => ({ file, scope: scopeOf(file), css: fs.readFileSync(file, 'utf8') }))
    const defined = new Map()
    for (const { scope, css } of files) {
      for (const match of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
        defined.set(match[1], [...(defined.get(match[1]) || []), scope])
      }
    }

    const offenders = []
    for (const { file, scope, css } of files) {
      for (const match of css.matchAll(/animation(?:-name)?\s*:\s*([^;{}]+);/g)) {
        for (const token of match[1].match(/[A-Za-z][\w-]*/g) || []) {
          const scopes = defined.get(token)
          if (!scopes || scopes.includes('eager') || scopes.includes(scope)) continue
          offenders.push(`${token} (defined in ${scopes.join(', ')}) is used by ${path.relative(root, file)}`)
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})
