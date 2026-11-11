import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import ModalFrame from './ModalFrame'

export default function CrashRecovery({ files, onDone }) {
  const { showToast } = useApp()
  const [processing, setProcessing] = useState(false)
  // Set once files were restored: the app has already loaded the old versions of them, so it must
  // load again before anything is edited, or the next save would write the old text over them.
  const [reloadNotice, setReloadNotice] = useState(null)

  const recoverAll = async () => {
    setProcessing(true)
    let recovered = 0
    let setAside = 0
    let failed = 0
    for (const f of files) {
      const result = await window.api.fs.recoverTmp(f)
      if (!result.ok) failed++
      else if (result.recovered) recovered++
      else setAside++
    }
    // An incomplete temporary file is not a newer version: the intact original was kept.
    const summary = setAside + failed === 0
      ? `已恢复 ${recovered} 个文件。`
      : `已恢复 ${recovered} 个文件；${setAside} 个临时文件内容不完整，已改名保存为 .incomplete，原文件未改动` +
        (failed ? `；${failed} 个处理失败` : '') + '。'
    setProcessing(false)
    if (recovered > 0) {
      setReloadNotice(summary)
      return
    }
    showToast(summary, setAside + failed === 0 ? 'success' : 'info', 8000)
    onDone()
  }

  const discardAll = async () => {
    setProcessing(true)
    for (const f of files) {
      await window.api.fs.discardTmp(f)
    }
    showToast('已清理临时文件', 'info')
    setProcessing(false)
    onDone()
  }

  if (reloadNotice) {
    return (
      <ModalFrame key="recovered" role="alertdialog" label="恢复完成">
          <div className="modal-header">
            <span className="modal-title">恢复完成</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: '16px', lineHeight: 1.6 }}>
            {reloadNotice}软件需要重新载入，才能显示并继续编辑恢复后的内容。
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" data-autofocus="" onClick={() => window.location.reload()}>重新载入</button>
          </div>
      </ModalFrame>
    )
  }

  return (
    <ModalFrame key="found" role="alertdialog" label="发现未保存的数据">
        <div className="modal-header">
          <span className="modal-title">⚠ 发现未保存的数据</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: '16px', lineHeight: 1.6 }}>
          检测到 {files.length} 个临时文件，可能是上次启动异常退出遗留的。是否恢复这些数据？
        </p>
        <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px', maxHeight: '150px', overflowY: 'auto' }}>
          {files.map(f => (
            <div key={f} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace', padding: '2px 0' }}>
              {f.split(/[/\\]/).slice(-3).join('/')}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={discardAll} disabled={processing}>
            丢弃
          </button>
          <button className="btn btn-primary" data-autofocus="" onClick={recoverAll} disabled={processing}>
            {processing ? '处理中...' : '恢复数据'}
          </button>
        </div>
    </ModalFrame>
  )
}
