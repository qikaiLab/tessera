import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const packageLock = JSON.parse(readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8'))
const braceExpansionPackagePaths = Object.keys(packageLock.packages).filter((packagePath) =>
  /(^|\/)node_modules\/brace-expansion$/.test(packagePath)
)

describe('patched transitive dependency adapters', () => {
  it.each(braceExpansionPackagePaths)(
    'keeps the legacy API on the bounded patched implementation at %s',
    (packagePath) => {
      const expand = require(join(process.cwd(), packagePath))

      expect(typeof expand).toBe('function')
      expect(expand.expand).toBe(expand)
      expect(expand.EXPANSION_MAX_LENGTH).toBe(4_000_000)
      expect(expand('{notes,timeline}.css')).toEqual(['notes.css', 'timeline.css'])
    }
  )
})
