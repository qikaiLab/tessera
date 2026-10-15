import { describe, expect, it, vi } from 'vitest'
import { buildContextMenuTemplate } from '../src/main/contextMenuTemplate.js'

describe('native context menu template', () => {
  it('turns plain data into menu items and drops hidden ones', () => {
    const sender = { send: vi.fn() }
    const template = buildContextMenuTemplate([
      { id: 'new', label: '新建' },
      { type: 'separator' },
      { role: 'copy', label: '复制', enabled: false },
      { id: 'secret', label: '隐藏', visible: false },
      null
    ], { scope: 'notes-list' }, sender)

    expect(template).toHaveLength(3)
    expect(template[0]).toMatchObject({ label: '新建', enabled: true })
    expect(template[1]).toEqual({ type: 'separator' })
    expect(template[2]).toMatchObject({ label: '复制', enabled: false, role: 'copy' })
    expect(template[2].click).toBeUndefined()
  })

  it('sends the chosen command back with the context it was opened with', () => {
    const sender = { send: vi.fn() }
    const [item] = buildContextMenuTemplate([{ id: 'delete', label: '删除' }], { scope: 'notes-list', noteId: 'n1' }, sender)
    item.click()
    expect(sender.send).toHaveBeenCalledWith('context-menu:command', {
      id: 'delete',
      context: { scope: 'notes-list', noteId: 'n1' }
    })
  })

  it('sends an empty context when none was given', () => {
    const sender = { send: vi.fn() }
    buildContextMenuTemplate([{ id: 'x', label: 'x' }], undefined, sender)[0].click()
    expect(sender.send).toHaveBeenCalledWith('context-menu:command', { id: 'x', context: {} })
  })

  it('returns nothing for items that are not a list', () => {
    expect(buildContextMenuTemplate(undefined, {}, { send: vi.fn() })).toEqual([])
    expect(buildContextMenuTemplate('menu', {}, { send: vi.fn() })).toEqual([])
  })
})
