import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import ModalFrame from './ModalFrame'
import './AutomaticHistory.css'

function previewContent(content) {
  try {
    const parsed = JSON.parse(content)
    if (parsed.content?.type === 'doc') {
      const text = node => node.text || (node.content || []).map(text).join(node.type === 'paragraph' ? '' : '\n')
      return text(parsed.content) || '空白便签'
    }
    return JSON.stringify(parsed, null, 2)
  } catch { return content }
}

export default function AutomaticHistory({ filePath, onClose, onRestore }) {
  const { showToast, confirm, flushPendingSaves } = useApp()
  const [entries, setEntries] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [revision, setRevision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    window.api.backup.automaticList(filePath).then(result => {
      if (cancelled) return
      if (!result.ok) setError(result.error)
      else {
        setEntries(result.data)
        setSelectedId(result.data.find(entry => entry.path !== 'notes/index.json')?.id || null)
      }
      setLoading(false)
    }).catch(error => { if (!cancelled) { setError(error.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [filePath])

  useEffect(() => {
    let cancelled = false
    setRevision(null)
    if (selectedId) window.api.backup.automaticRead(selectedId).then(result => {
      if (cancelled) return
      if (result.ok) setRevision(result.data)
      else setError(result.error)
    }).catch(error => { if (!cancelled) setError(error.message) })
    return () => { cancelled = true }
  }, [selectedId])

  const noteCopy = revision && /^notes\/(?!index\.json$)[^/]+\.json$/.test(revision.path)
  const restore = async () => {
    if (!revision || busy) return
    if (!noteCopy && !await confirm({
      title: '恢复文件', message: `恢复 ${revision.path} 的这个版本？当前内容会先存入自动历史，恢复后应用将重新加载。`, confirmText: '恢复'
    })) return
    setBusy(true)
    try {
      if (!await flushPendingSaves()) throw new Error('当前编辑保存失败，请先重试保存')
      const result = await window.api.backup.automaticRestore(revision.id)
      if (!result.ok) throw new Error(result.error)
      showToast(result.copied ? '已恢复为新便签，原便签保留' : '文件已恢复', 'success')
      if (result.copied) { await onRestore?.(); onClose() }
      else window.location.reload()
    } catch (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  const visibleEntries = entries.filter(entry => entry.path !== 'notes/index.json' &&
    `${entry.title} ${entry.path}`.toLowerCase().includes(filter.toLowerCase()))

  return (
    // Esc and a click outside close it, except while a restore is running.
    <ModalFrame className="modal automatic-history" label="自动历史" onDismiss={busy ? undefined : onClose}>
        <div className="modal-header"><span className="modal-title">自动历史</span><button className="btn btn-ghost" onClick={onClose} disabled={busy}>关闭</button></div>
        <p className="history-description">只保存变化的文件，内容压缩去重。便签会恢复为新副本，也可以找回已删除的便签。</p>
        <input className="input" data-autofocus="" aria-label="搜索历史" placeholder="搜索便签标题或文件" value={filter} onChange={event => setFilter(event.target.value)} disabled={busy} />
        {error && <p role="alert">{error}</p>}
        <div className="history-columns">
          <div className="history-list">
            {loading ? <p>正在读取历史…</p> : visibleEntries.length === 0 ? <p>暂无历史。启用此版本后，文件发生保存或删除时会自动记录。</p> : visibleEntries.map(entry => (
              <button key={entry.id} className={`history-entry ${selectedId === entry.id ? 'active' : ''}`} onClick={() => setSelectedId(entry.id)} disabled={busy}>
                <strong>{entry.title}</strong><span>{new Date(entry.capturedAt).toLocaleString('zh-CN')}</span><small>{entry.reason === 'delete' ? '删除前' : entry.reason === 'before-write' ? '覆盖前' : '已保存'} · {entry.path}</small>
              </button>
            ))}
          </div>
          <div className="history-detail">
            <pre className="history-preview">{revision ? previewContent(revision.content) : '选择一个版本查看正文'}</pre>
            <button className="btn btn-primary" onClick={restore} disabled={!revision || busy || revision.path === 'notes/index.json'}>{busy ? '正在恢复…' : noteCopy ? '恢复为新便签' : '恢复此文件'}</button>
          </div>
        </div>
    </ModalFrame>
  )
}
