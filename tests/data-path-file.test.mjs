import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readDataPathFile, resolveDataDirectory, syncDataPathFile } from '../src/main/dataDirectory.js'

let root
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'tessera-datapath-')) })
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

const read = () => fs.readFile(path.join(root, 'datapath.txt'), 'utf8')
const utf16File = text => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])

describe('datapath.txt, the way the uninstaller finds the data folder', () => {
  it('is created when missing', async () => {
    expect(syncDataPathFile(root, 'D:/Journal')).toBe(true)
    expect(await read()).toBe('D:/Journal')
  })

  it('follows a move made in Settings instead of keeping the installer-time value', async () => {
    await fs.writeFile(path.join(root, 'datapath.txt'), 'C:/Users/me/Tessera/data')
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

describe('datapath.txt with characters outside ASCII', () => {
  const folder = 'D:\\日记'

  it('is written as UTF-16 with a byte order mark, which is what the installer and uninstaller read', async () => {
    expect(syncDataPathFile(root, folder)).toBe(true)
    const file = path.join(root, 'datapath.txt')
    expect((await fs.readFile(file)).equals(utf16File(folder))).toBe(true)
    expect(readDataPathFile(file)).toEqual({ text: folder, utf16: true, bom8: false })
  })

  it('rewrites a UTF-8 file that starts with a byte order mark, which the uninstaller would misread', async () => {
    const file = path.join(root, 'datapath.txt')
    await fs.writeFile(file, Buffer.from('\uFEFFD:/Journal', 'utf8'))
    expect(readDataPathFile(file)).toEqual({ text: 'D:/Journal', utf16: false, bom8: true })
    expect(syncDataPathFile(root, 'D:/Journal')).toBe(true)
    expect((await fs.readFile(file)).equals(Buffer.from('D:/Journal', 'utf8'))).toBe(true)
    // Once clean it is left alone.
    expect(syncDataPathFile(root, 'D:/Journal')).toBe(false)
  })

  it('keeps a plain path as plain UTF-8, the same bytes every version has written', async () => {
    syncDataPathFile(root, 'D:\\Journal')
    expect((await fs.readFile(path.join(root, 'datapath.txt'))).equals(Buffer.from('D:\\Journal', 'utf8'))).toBe(true)
  })

  it('leaves a correct UTF-16 file alone, and converts an old UTF-8 one that the uninstaller would misread', async () => {
    const file = path.join(root, 'datapath.txt')
    await fs.writeFile(file, utf16File(folder))
    expect(syncDataPathFile(root, folder)).toBe(false)
    // Written by an older version: the right text, but the uninstaller would read it as garbage.
    await fs.writeFile(file, folder, 'utf8')
    expect(syncDataPathFile(root, folder)).toBe(true)
    expect(readDataPathFile(file).utf16).toBe(true)
    // A UTF-16 file for a plain path (the installer always writes that form) is left as it is.
    await fs.writeFile(file, utf16File('D:\\Journal'))
    expect(syncDataPathFile(root, 'D:\\Journal')).toBe(false)
  })

  it('is read at startup when the config names no folder, whatever the encoding', async () => {
    const file = path.join(root, 'datapath.txt')
    const encodings = [
      utf16File(`${folder}\r\n`),
      Buffer.from(`${folder}\r\n`, 'utf8'),
      Buffer.from(`\uFEFF${folder}`, 'utf8')
    ]
    for (const bytes of encodings) {
      await fs.writeFile(file, bytes)
      const resolved = resolveDataDirectory({ config: {}, runtimeOverrides: null, userDataDir: root, homeDir: 'C:\\Users\\me' })
      expect(resolved).toEqual({ dataDir: folder, migratedPath: folder })
    }
  })
})
