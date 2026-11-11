import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readConfigFile, writeConfigFile } from '../src/main/configStore.js'

const created = []

function makeConfigPath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tessera-config-'))
  created.push(directory)
  return path.join(directory, 'config.json')
}

afterEach(() => {
  for (const directory of created.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('config store', () => {
  it('returns an empty config when nothing was saved yet', () => {
    expect(readConfigFile(makeConfigPath())).toEqual({})
  })

  it('round-trips a config and leaves no temporary file behind', () => {
    const file = makeConfigPath()
    writeConfigFile(file, { dataDir: 'D:/MyData', theme: 'dark' })
    expect(readConfigFile(file)).toEqual({ dataDir: 'D:/MyData', theme: 'dark' })
    expect(fs.existsSync(`${file}.tmp`)).toBe(false)
  })

  it('keeps the previous version as a backup', () => {
    const file = makeConfigPath()
    writeConfigFile(file, { dataDir: 'D:/MyData', theme: 'dark' })
    writeConfigFile(file, { dataDir: 'D:/MyData', theme: 'light' })
    expect(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')).theme).toBe('dark')
  })

  it('recovers the last good config when the file is truncated', () => {
    const file = makeConfigPath()
    writeConfigFile(file, { dataDir: 'D:/MyData' })
    writeConfigFile(file, { dataDir: 'D:/MyData', theme: 'light' })
    fs.writeFileSync(file, '{"dataDir": "D:/My')
    expect(readConfigFile(file).dataDir).toBe('D:/MyData')
  })

  it('does not replace a good backup with a corrupt file', () => {
    const file = makeConfigPath()
    writeConfigFile(file, { dataDir: 'D:/MyData' })
    writeConfigFile(file, { dataDir: 'D:/MyData', theme: 'light' })
    fs.writeFileSync(file, 'not json')
    writeConfigFile(file, { dataDir: 'D:/MyData', theme: 'dark' })
    // The corrupt file was not copied over the backup, which still holds the first good version.
    expect(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8'))).toEqual({ dataDir: 'D:/MyData' })
    expect(readConfigFile(file).theme).toBe('dark')
  })

  it('ignores a config that is not a JSON object', () => {
    const file = makeConfigPath()
    fs.writeFileSync(file, '[1, 2, 3]')
    expect(readConfigFile(file)).toEqual({})
  })
})
