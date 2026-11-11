import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inspectFolder, readPendingChange, resolveStartupDataDirectory } from '../src/main/dataDirectoryStartup.js'

let root
let home
let userData
const at = (...parts) => path.join(root, ...parts)

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'tessera-startup-'))
  home = at('home')
  userData = at('user-data')
  await fs.mkdir(home, { recursive: true })
  await fs.mkdir(userData, { recursive: true })
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

const start = (config, extra = {}) => resolveStartupDataDirectory({
  config, runtimeOverrides: null, userDataDir: userData, homeDir: home, ...extra
})

async function makeData(dir) {
  await fs.mkdir(path.join(dir, '2026', '10'), { recursive: true })
  await fs.writeFile(path.join(dir, 'sections.json'), '[{"id":"diary"}]')
  await fs.writeFile(path.join(dir, '2026', '10', '13.json'), '{"diary":{"value":"x"}}')
}

describe('starting with a saved data folder', () => {
  it('uses the saved folder and changes nothing', async () => {
    const dir = at('mine')
    await makeData(dir)
    const result = await start({ dataDir: dir, theme: 'dark' })
    expect(result).toMatchObject({ dataDir: dir, configChanged: false, notice: null, abort: false })
  })

  it('creates the default folder on a first launch', async () => {
    const result = await start({})
    expect(result.abort).toBe(false)
    expect(result.dataDir).toBe(path.join(home, 'Tessera', 'data'))
  })

  it('moves the old datapath.txt into the config', async () => {
    const dir = at('legacy')
    await makeData(dir)
    await fs.writeFile(path.join(userData, 'datapath.txt'), dir)
    const result = await start({})
    expect(result).toMatchObject({ dataDir: dir, configChanged: true })
    expect(result.config.dataDir).toBe(dir)
  })
})

describe('a saved folder that is gone', () => {
  it('is not quietly recreated empty: the user is asked, and quitting changes nothing', async () => {
    const dir = at('unplugged-drive', 'TesseraData')
    const asked = []
    const config = { dataDir: dir }
    const result = await start(config, { chooseWhenUnavailable: async (info) => { asked.push(info); return null } })
    expect(asked).toEqual([{ dir, problem: 'missing' }])
    expect(result).toMatchObject({ abort: true, configChanged: false })
    await expect(fs.stat(dir)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(config).toEqual({ dataDir: dir })
  })

  it('aborts when nobody can be asked, or the answer is unusable', async () => {
    const dir = at('gone')
    expect((await start({ dataDir: dir })).abort).toBe(true)
    expect((await start({ dataDir: dir }, { chooseWhenUnavailable: async () => ({ dir: at('also-gone') }) })).abort).toBe(true)
    expect((await start({ dataDir: dir }, { chooseWhenUnavailable: async () => { throw new Error('dialog failed') } })).abort).toBe(true)
  })

  it('switches to another existing folder the user picks, and says so', async () => {
    const dir = at('gone')
    const other = at('other')
    await makeData(other)
    const result = await start({ dataDir: dir, theme: 'dark' }, { chooseWhenUnavailable: async () => ({ dir: other }) })
    expect(result).toMatchObject({ abort: false, dataDir: other, configChanged: true, notice: { kind: 'relocated', from: dir, to: other } })
    expect(result.config).toMatchObject({ dataDir: other, theme: 'dark' })
  })

  it('also asks when the saved path is a file', async () => {
    const file = at('a-file')
    await fs.writeFile(file, 'x')
    const asked = []
    await start({ dataDir: file }, { chooseWhenUnavailable: async (info) => { asked.push(info); return null } })
    expect(asked[0].problem).toBe('not-a-folder')
  })
})

describe('a requested move', () => {
  const config = (from, to, copy = true) => ({ dataDir: from, theme: 'dark', pendingDataDirChange: { from, to, copy } })

  it('copies, verifies, switches and clears the request', async () => {
    const from = at('old')
    const to = at('new')
    await makeData(from)
    const result = await start(config(from, to))
    expect(result).toMatchObject({ abort: false, dataDir: to, configChanged: true, notice: { kind: 'switched', from, to } })
    expect(result.config).toEqual({ dataDir: to, theme: 'dark' })
    expect(await fs.readFile(path.join(to, '2026', '10', '13.json'), 'utf8')).toBe('{"diary":{"value":"x"}}')
    expect(await fs.readFile(path.join(from, '2026', '10', '13.json'), 'utf8')).toBe('{"diary":{"value":"x"}}')
  })

  it('stays on the old folder, with the data, when the target is not usable', async () => {
    const from = at('old')
    const to = at('new')
    await makeData(from)
    await fs.mkdir(to)
    await fs.writeFile(path.join(to, 'other.txt'), 'not ours')
    const result = await start(config(from, to))
    expect(result).toMatchObject({ abort: false, dataDir: from, configChanged: true, notice: { kind: 'failed', reason: 'foreign' } })
    expect(result.config).toEqual({ dataDir: from, theme: 'dark' })
    expect(await fs.readdir(from)).toContain('sections.json')
  })

  it('drops a request that was made for another folder', async () => {
    const from = at('old')
    await makeData(from)
    const result = await start({ dataDir: from, pendingDataDirChange: { from: at('somewhere-else'), to: at('new'), copy: true } })
    expect(result).toMatchObject({ dataDir: from, notice: { kind: 'failed', reason: 'stale' } })
    expect(result.config.pendingDataDirChange).toBeUndefined()
    await expect(fs.stat(at('new'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('discards a malformed request without acting on it', async () => {
    const from = at('old')
    await makeData(from)
    const result = await start({ dataDir: from, pendingDataDirChange: { to: 5 } })
    expect(result).toMatchObject({ dataDir: from, notice: null, configChanged: true })
    expect(result.config.pendingDataDirChange).toBeUndefined()
  })

  it('does not act on a request when the folder being left is missing', async () => {
    const from = at('gone')
    const to = at('new')
    const result = await start(config(from, to))
    expect(result.abort).toBe(true)
    await expect(fs.stat(to)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('is ignored by runs that pin their data folder', async () => {
    const pinned = at('pinned')
    await makeData(pinned)
    const result = await start(config(at('old'), at('new')), {
      runtimeOverrides: { userDataDir: userData, dataDir: pinned, fixedDataDir: true }
    })
    expect(result).toMatchObject({ dataDir: pinned, configChanged: false, notice: null })
    await expect(fs.stat(at('new'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('helpers', () => {
  it('only accepts a well-formed pending request', () => {
    expect(readPendingChange({})).toBeNull()
    expect(readPendingChange({ pendingDataDirChange: { from: 'a' } })).toBeNull()
    expect(readPendingChange({ pendingDataDirChange: { from: 'a', to: 'b', copy: 'yes' } })).toEqual({ from: 'a', to: 'b', copy: false })
    expect(readPendingChange({ pendingDataDirChange: { from: 'a', to: 'b', copy: true } })).toEqual({ from: 'a', to: 'b', copy: true })
  })

  it('tells a folder from a file from nothing', async () => {
    const file = at('f')
    await fs.writeFile(file, 'x')
    expect(inspectFolder(root)).toBe('ok')
    expect(inspectFolder(file)).toBe('not-a-folder')
    expect(inspectFolder(at('nothing'))).toBe('missing')
  })
})
