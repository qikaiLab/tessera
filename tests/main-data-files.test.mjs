import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  backupFileName,
  collectJsonFiles,
  ensureDir,
  findTemporaryFiles,
  listBackups,
  readDirOrEmpty,
  scanDayDates,
  writeBackupZip
} from '../src/main/dataFiles.js'
import { getDefaultDataDir, resolveDataDirectory } from '../src/main/dataDirectory.js'

let root

function write(relativePath, content = '{}') {
  const full = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
  return full
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mototrace-main-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('scanning the data directory', () => {
  it('finds every day file by its year / month / day path', async () => {
    write('2026/10/13.json')
    write('2026/10/12.json')
    write('2025/01/01.json')
    // Not days: wrong shapes, other folders and files.
    write('2026/10/notes.json')
    write('2026/1/05.json')
    write('notes/abc.json')
    write('sections.json')
    expect((await scanDayDates(root)).sort()).toEqual(['2025-01-01', '2026-10-12', '2026-10-13'])
  })

  it('returns nothing for a directory that does not exist', async () => {
    expect(await scanDayDates(path.join(root, 'missing'))).toEqual([])
  })

  it('finds leftover temporary files anywhere', async () => {
    write('2026/10/13.json.tmp')
    write('notes/a.json.tmp')
    write('sections.json')
    const found = (await findTemporaryFiles(root)).map(file => path.relative(root, file).split(path.sep).join('/')).sort()
    expect(found).toEqual(['2026/10/13.json.tmp', 'notes/a.json.tmp'])
  })

  it('reads a missing folder as empty', async () => {
    expect(await readDirOrEmpty(path.join(root, 'nothing'))).toEqual([])
    write('notes/a.json')
    expect(await readDirOrEmpty(path.join(root, 'notes'))).toEqual(['a.json'])
  })

  it('creates nested folders and accepts ones that exist', async () => {
    await ensureDir(path.join(root, 'a', 'b'))
    await ensureDir(path.join(root, 'a', 'b'))
    expect(fs.existsSync(path.join(root, 'a', 'b'))).toBe(true)
  })
})

describe('collecting a backup', () => {
  it('collects the JSON files with relative paths, leaving out backups and other files', async () => {
    write('sections.json', '[1]')
    write('2026/10/13.json', '{"a":1}')
    write('notes/index.json', '[]')
    write('notes/readme.txt', 'x')
    write('backups/old.json', '{}')
    write('backups/backup-2026.zip', 'zip')
    const files = await collectJsonFiles(root)
    expect(files.map(file => file.path).sort()).toEqual(['2026/10/13.json', 'notes/index.json', 'sections.json'])
    expect(files.find(file => file.path === 'sections.json').content).toBe('[1]')
  })
})

describe('backup ZIP files', () => {
  it('names a backup by its timestamp', () => {
    expect(backupFileName(new Date('2026-10-13T08:09:10.123Z'))).toBe('backup-2026-10-13T08-09-10.zip')
  })

  it('writes a backup from base64 and keeps only the newest ones', async () => {
    const folder = path.join(root, 'backups')
    await ensureDir(folder)
    for (let day = 1; day <= 5; day += 1) {
      await writeBackupZip(path.join(folder, `backup-2026-10-0${day}T00-00-00.zip`), Buffer.from(`zip ${day}`).toString('base64'), 3)
    }
    expect(fs.readdirSync(folder).sort()).toEqual([
      'backup-2026-10-03T00-00-00.zip',
      'backup-2026-10-04T00-00-00.zip',
      'backup-2026-10-05T00-00-00.zip'
    ])
    expect(fs.readFileSync(path.join(folder, 'backup-2026-10-05T00-00-00.zip'), 'utf8')).toBe('zip 5')
  })

  it('does not touch other files in the backups folder when pruning', async () => {
    const folder = path.join(root, 'backups')
    await ensureDir(folder)
    fs.writeFileSync(path.join(folder, 'keep-me.txt'), 'x')
    await writeBackupZip(path.join(folder, 'backup-2026-10-01T00-00-00.zip'), 'AA==', 1)
    await writeBackupZip(path.join(folder, 'backup-2026-10-02T00-00-00.zip'), 'AA==', 1)
    expect(fs.readdirSync(folder).sort()).toEqual(['backup-2026-10-02T00-00-00.zip', 'keep-me.txt'])
  })

  it('lists the ZIP backups, newest first, with their size', async () => {
    const folder = path.join(root, 'backups')
    write('backups/backup-2026-10-01T00-00-00.zip', '12345')
    write('backups/backup-2026-10-02T00-00-00.zip', '123')
    write('backups/readme.txt', 'ignored')
    const backups = await listBackups(folder)
    expect(backups.map(backup => backup.name)).toEqual(['backup-2026-10-02T00-00-00.zip', 'backup-2026-10-01T00-00-00.zip'])
    expect(backups[0].size).toBe(3)
    expect(backups[0].path).toBe(path.join(folder, 'backup-2026-10-02T00-00-00.zip'))
    expect(await listBackups(path.join(root, 'none'))).toEqual([])
  })
})

describe('the data directory at startup', () => {
  const homeDir = path.join(os.tmpdir(), 'home')

  it('uses the directory saved in the config', () => {
    const resolved = resolveDataDirectory({ config: { dataDir: '/custom' }, runtimeOverrides: null, userDataDir: root, homeDir })
    expect(resolved).toEqual({ dataDir: '/custom', migratedPath: null })
  })

  it('falls back to the default directory', () => {
    const resolved = resolveDataDirectory({ config: {}, runtimeOverrides: null, userDataDir: root, homeDir })
    expect(resolved.dataDir).toBe(getDefaultDataDir(homeDir))
    expect(resolved.migratedPath).toBeNull()
  })

  it('reads the directory older versions kept in datapath.txt and reports it for saving', () => {
    write('datapath.txt', '  D:\\MyData  \n')
    const resolved = resolveDataDirectory({ config: {}, runtimeOverrides: null, userDataDir: root, homeDir })
    expect(resolved).toEqual({ dataDir: 'D:\\MyData', migratedPath: 'D:\\MyData' })
  })

  it('ignores an empty datapath.txt', () => {
    write('datapath.txt', '   ')
    const resolved = resolveDataDirectory({ config: {}, runtimeOverrides: null, userDataDir: root, homeDir })
    expect(resolved.migratedPath).toBeNull()
  })

  it('lets a pinned run keep its own directory whatever the config says', () => {
    const overrides = { fixedDataDir: true, dataDir: '/sandbox/data' }
    const resolved = resolveDataDirectory({ config: { dataDir: '/real' }, runtimeOverrides: overrides, userDataDir: root, homeDir })
    expect(resolved.dataDir).toBe('/sandbox/data')
    // Not pinned: the config wins, the override is only the fallback.
    const soft = resolveDataDirectory({ config: {}, runtimeOverrides: { fixedDataDir: false, dataDir: '/dev/data' }, userDataDir: root, homeDir })
    expect(soft.dataDir).toBe('/dev/data')
  })
})
