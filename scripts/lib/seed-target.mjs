// Shared by the sample-data scripts: which directory they may write into.
//
// A seed script overwrites its target, so it only writes into an empty directory or one a seed
// script created before (marked by a file named MARKER), and never into or around the real default
// data directory.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const MARKER = '.tessera-dev-seed'

export const realDataDir = path.resolve(os.homedir(), 'Tessera', 'data')

function isInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export async function assertSafeTarget(target) {
  if (isInside(realDataDir, target) || isInside(target, realDataDir)) {
    throw new Error(`Refusing to seed ${target}: it overlaps the real data directory ${realDataDir}`)
  }
  let entries
  try {
    entries = await fs.readdir(target)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  if (entries.length > 0 && !entries.includes(MARKER)) {
    throw new Error(`Refusing to seed ${target}: it is not empty and was not created by this script`)
  }
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8')
}
