import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const script = path.resolve('scripts/seed-dev-data.mjs')
const created = []

function run(directory) {
  return spawnSync(process.execPath, [script, directory], { encoding: 'utf8' })
}

function makeTempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mototrace-seed-'))
  created.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of created.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('seed-dev-data script', () => {
  it('writes sections, day files, notes and metadata, and can be re-run', () => {
    const target = path.join(makeTempDir(), 'data')
    expect(run(target).status).toBe(0)

    const sections = JSON.parse(fs.readFileSync(path.join(target, 'sections.json'), 'utf8'))
    expect(sections.map(section => section.id)).toContain('diary')
    expect(fs.existsSync(path.join(target, 'notes', 'index.json'))).toBe(true)
    const metadata = JSON.parse(fs.readFileSync(path.join(target, 'metadata.json'), 'utf8'))
    expect(metadata.analytics.length).toBeGreaterThan(0)

    const years = fs.readdirSync(target).filter(name => /^\d{4}$/.test(name))
    expect(years.length).toBeGreaterThan(0)

    expect(run(target).status).toBe(0)
  })

  it('refuses a non-empty directory it did not create', () => {
    const target = makeTempDir()
    fs.writeFileSync(path.join(target, 'precious.json'), '{}')
    const result = run(target)
    expect(result.status).not.toBe(0)
    expect(fs.existsSync(path.join(target, 'precious.json'))).toBe(true)
  })

  it('refuses the real default data directory', () => {
    const result = run(path.join(os.homedir(), 'MotoTrace', 'data'))
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('real data directory')
  })
})
