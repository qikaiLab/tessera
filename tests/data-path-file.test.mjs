import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { syncDataPathFile } from '../src/main/dataDirectory.js'

let root
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'mototrace-datapath-')) })
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

const read = () => fs.readFile(path.join(root, 'datapath.txt'), 'utf8')

describe('datapath.txt, the way the uninstaller finds the data folder', () => {
  it('is created when missing', async () => {
    expect(syncDataPathFile(root, 'D:/Journal')).toBe(true)
    expect(await read()).toBe('D:/Journal')
  })

  it('follows a move made in Settings instead of keeping the installer-time value', async () => {
    await fs.writeFile(path.join(root, 'datapath.txt'), 'C:/Users/me/MotoTrace/data')
    expect(syncDataPathFile(root, 'D:/Journal')).toBe(true)
    expect(await read()).toBe('D:/Journal')
  })

  it('leaves the file alone when it already names the folder in use', async () => {
    await fs.writeFile(path.join(root, 'datapath.txt'), 'D:/Journal\n')
    expect(syncDataPathFile(root, 'D:/Journal')).toBe(false)
    expect(await read()).toBe('D:/Journal\n')
  })

  it('creates the settings folder if needed and never throws', async () => {
    const nested = path.join(root, 'not', 'yet')
    expect(syncDataPathFile(nested, 'D:/Journal')).toBe(true)
    expect(await fs.readFile(path.join(nested, 'datapath.txt'), 'utf8')).toBe('D:/Journal')
    expect(syncDataPathFile('', 'D:/Journal')).toBe(false)
    expect(syncDataPathFile(root, '')).toBe(false)
    // A path that cannot be a folder (a file is in the way) is reported as not written, not thrown.
    const blocker = path.join(root, 'blocker')
    await fs.writeFile(blocker, 'x')
    expect(syncDataPathFile(path.join(blocker, 'x'), 'D:/Journal')).toBe(false)
  })
})
