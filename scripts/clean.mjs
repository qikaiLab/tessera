import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allowedTargets = ['out', 'release']

for (const name of allowedTargets) {
  const target = path.resolve(rootDir, name)
  if (path.dirname(target) !== rootDir || path.basename(target) !== name) {
    throw new Error(`Refusing to clean unexpected path: ${target}`)
  }
  fs.rmSync(target, { recursive: true, force: true })
  console.log(`Cleaned ${name}/`)
}
