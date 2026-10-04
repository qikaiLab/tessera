'use strict'

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

if (braceExpansionPackagePaths.length === 0) {
  throw new Error('No installed brace-expansion packages were found in package-lock.json')
}

for (const packagePath of braceExpansionPackagePaths) {
  const packageRoot = join(projectRoot, packagePath)
  const packageMetadata = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  const braceExpansionEntry = join(packageRoot, 'dist', 'commonjs', 'index.js')

  if (packageMetadata.version !== '5.0.12' || !existsSync(braceExpansionEntry)) {
    throw new Error(`Unsupported brace-expansion installation at ${packagePath}`)
  }

  const source = readFileSync(braceExpansionEntry, 'utf8')
  if (!source.includes(compatibilityMarker)) {
    writeFileSync(braceExpansionEntry, source + compatibilityPatch, 'utf8')
  }
}
