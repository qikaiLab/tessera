import React, { useState } from 'react'
import { useApp } from '../context/AppContext'

export default function CrashRecovery({ files, onDone }) {
  const { showToast } = useApp()
  const [processing, setProcessing] = useState(false)

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
    if (setAside + failed === 0) {
      showToast(`已恢复 ${recovered} 个文件`, 'success')
    } else {
      // An incomplete temporary file is not a newer version: the intact original was kept.
      showToast(
        `已恢复 ${recovered} 个文件；${setAside} 个临时文件内容不完整，已改名保存为 .incomplete，原文件未改动` +
          (failed ? `；${failed} 个处理失败` : ''),
        'info',
        8000
      )
    }
    setProcessing(false)
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

  return (
    <div className="modal-overlay">
      <div className="modal">
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
          <button className="btn btn-primary" onClick={recoverAll} disabled={processing}>
            {processing ? '处理中...' : '恢复数据'}
          </button>
        </div>
      </div>
    </div>
  )
}
