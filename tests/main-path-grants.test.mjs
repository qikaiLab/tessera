import { describe, expect, it } from 'vitest'
import { createPathGrants } from '../src/main/pathGrants.js'

const WIN_EXPORT = 'C:\\Users\\me\\export.zip'
const WIN_BACKUP = 'C:\\Users\\me\\backup.zip'

describe('path grants for export and import', () => {
  it('accepts only a path the user picked, and only once', () => {
    const grants = createPathGrants({ platform: 'win32' })
    grants.grant('write', WIN_EXPORT)
    expect(grants.consume('write', WIN_EXPORT)).toBe(true)
    expect(grants.consume('write', WIN_EXPORT)).toBe(false)
  })

  it('refuses any other path, and a path granted for the other direction', () => {
    const grants = createPathGrants({ platform: 'win32' })
    grants.grant('read', WIN_BACKUP)
    expect(grants.consume('read', 'C:\\Windows\\win.ini')).toBe(false)
    expect(grants.consume('write', WIN_BACKUP)).toBe(false)
    expect(grants.consume('read', '')).toBe(false)
    expect(grants.consume('read', undefined)).toBe(false)
  })

  it('treats Windows paths case-insensitively and normalizes them', () => {
    const grants = createPathGrants({ platform: 'win32' })
    grants.grant('read', 'C:\\Users\\Me\\Backup.ZIP')
    expect(grants.consume('read', 'c:\\users\\me\\.\\backup.zip')).toBe(true)
  })

  it('forgets the oldest grants instead of growing without bound', () => {
    const grants = createPathGrants({ platform: 'linux' })
    for (let index = 0; index < 80; index += 1) grants.grant('read', `/tmp/file-${index}.zip`)
    expect(grants.consume('read', '/tmp/file-0.zip')).toBe(false)
    expect(grants.consume('read', '/tmp/file-79.zip')).toBe(true)
  })
})
