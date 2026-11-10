import { describe, expect, it } from 'vitest'
import { createPathGrants } from '../src/main/pathGrants.js'
import { describeDataDirNotice, describeDataDirPlan, formatBytes } from '../src/renderer/src/utils/dataDirChange.js'

const here = { current: 'C:/Data/old', target: 'D:/Backup/new' }

describe('describing a data folder change', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB')
    expect(formatBytes(NaN)).toBe('')
  })

  it('explains a copy, and says the old folder is not touched', () => {
    const result = describeDataDirPlan({ kind: 'empty', files: 12, bytes: 4096 }, here)
    expect(result).toMatchObject({ ok: true, copy: true })
    expect(result.message).toContain('12 个文件')
    expect(result.message).toContain(here.target)
    expect(result.message).toContain(here.current)
    expect(result.message).toContain('不会被删除或改动')
  })

  it('mentions an earlier unfinished copy', () => {
    expect(describeDataDirPlan({ kind: 'resume', files: 1, bytes: 1 }, here).message).toContain('未完成的复制')
  })

  it('explains that an existing data folder is used as it is, without merging', () => {
    const result = describeDataDirPlan({ kind: 'existing', files: 7 }, here)
    expect(result).toMatchObject({ ok: true, copy: false })
    expect(result.message).toContain('不会复制')
    expect(result.message).toContain('不会与当前数据合并')
  })

  it('gives a reason for every folder that cannot be used', () => {
    for (const plan of [
      { kind: 'same' }, { kind: 'nested' }, { kind: 'foreign' }, { kind: 'mystery' },
      { kind: 'unusable', reason: 'not-writable' }, { kind: 'unusable', reason: 'unknown-reason' }
    ]) {
      const result = describeDataDirPlan(plan, here)
      expect(result.ok).toBe(false)
      expect(result.message.length).toBeGreaterThan(10)
    }
    expect(describeDataDirPlan(undefined, here).ok).toBe(false)
  })

  it('reports the outcome of a move at startup', () => {
    expect(describeDataDirNotice(null)).toBeNull()
    expect(describeDataDirNotice({ kind: 'switched', from: 'a', to: 'b', copied: { files: 1 } }))
      .toMatchObject({ type: 'success', message: expect.stringContaining('复制并核对完成') })
    expect(describeDataDirNotice({ kind: 'switched', from: 'a', to: 'b', copied: null }).message).toContain('已有的数据目录')
    expect(describeDataDirNotice({ kind: 'relocated', from: 'a', to: 'b' }).type).toBe('info')
    const failed = describeDataDirNotice({ kind: 'failed', from: 'a', to: 'b', error: 'boom', reason: 'error' })
    expect(failed.type).toBe('error')
    expect(failed.message).toContain('没有受到影响')
    expect(failed.message).toContain('boom')
    expect(describeDataDirNotice({ kind: 'failed', from: 'a', to: 'b', reason: 'stale' }).message).toContain('过期')
  })
})

describe('folder grants', () => {
  it('can be checked without being used up', () => {
    const grants = createPathGrants({ platform: 'win32' })
    grants.grant('folder', 'D:/Backup/New')
    expect(grants.has('folder', 'd:/backup/new')).toBe(true)
    expect(grants.has('folder', 'd:/backup/new')).toBe(true)
    expect(grants.has('read', 'D:/Backup/New')).toBe(false)
    expect(grants.has('folder', '')).toBe(false)
    expect(grants.has('folder', undefined)).toBe(false)
    expect(grants.consume('folder', 'D:/Backup/New')).toBe(true)
    expect(grants.has('folder', 'D:/Backup/New')).toBe(false)
  })
})
