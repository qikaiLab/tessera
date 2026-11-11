'use strict'

// brace-expansion 5 exports { expand } from its CommonJS build, while the older copies of minimatch
// that electron-builder's tooling still loads call require('brace-expansion')(pattern). This adds the
// callable export. It looks at what is installed instead of at a version number, so a routine update
// of the package does not break `npm install`; it only fails when the package no longer offers
// something this adapter can work with, or the result is not callable (which would otherwise
// surface much later as a crash while packaging).

const { existsSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const projectRoot = process.cwd()
const packageLock = JSON.parse(readFileSync(join(projectRoot, 'package-lock.json'), 'utf8'))
const braceExpansionPackagePaths = Object.keys(packageLock.packages).filter((packagePath) =>
  /(^|\/)node_modules\/brace-expansion$/.test(packagePath)
)
const compatibilityMarker = 'MotoTrace legacy CommonJS compatibility'
const compatibilityPatch = `

// ${compatibilityMarker}
const legacyExpand = module.exports.expand
Object.assign(legacyExpand, module.exports)
module.exports = legacyExpand
`

function loadFresh(entry) {
  delete require.cache[require.resolve(entry)]
  return require(entry)
}

if (braceExpansionPackagePaths.length === 0) {
  throw new Error('No installed brace-expansion packages were found in package-lock.json')
}

for (const packagePath of braceExpansionPackagePaths) {
  const packageRoot = join(projectRoot, packagePath)
  const packageMetadata = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  const entry = join(packageRoot, 'dist', 'commonjs', 'index.js')

  if (!existsSync(entry)) {
    throw new Error(`brace-expansion ${packageMetadata.version} at ${packagePath} has no dist/commonjs/index.js to adapt`)
  }

  const source = readFileSync(entry, 'utf8')
  if (!source.includes(compatibilityMarker)) {
    const exported = loadFresh(entry)
    // Already callable (the package fixed this itself): nothing to do.
    if (typeof exported !== 'function') {
      if (typeof exported?.expand !== 'function') {
        throw new Error(`brace-expansion ${packageMetadata.version} at ${packagePath} exports neither a function nor expand(): cannot adapt it`)
      }
      writeFileSync(entry, source + compatibilityPatch, 'utf8')
    }
  }

  const adapted = loadFresh(entry)
  if (typeof adapted !== 'function') {
    throw new Error(`brace-expansion ${packageMetadata.version} at ${packagePath} is still not callable after patching`)
  }
}
