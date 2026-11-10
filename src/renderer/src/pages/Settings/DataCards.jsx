import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { describeDataDirPlan } from '../../utils/dataDirChange'
import { useBackups } from './useBackups'
import './DataCards.css'

// Where the data lives, and how to rebuild its index. Changing the folder only schedules a move:
// the data is copied and checked at the next start, and the old folder is never touched.
function StorageCard({ hidden }) {
  const { dataDir, showToast, refreshDates, confirm } = useApp()
  const [pending, setPending] = useState(null)

  useEffect(() => {
    window.api.config.get().then(config => setPending(config.pendingDataDirChange || null))
  }, [])

  const pickDataDir = async () => {
    const dir = await window.api.dialog.openDirectory()
    if (!dir) return
    const planned = await window.api.config.planDataDirChange(dir)
    if (!planned.ok) {
      showToast('无法检查所选文件夹，数据目录没有更改。', 'error')
      return
    }
    const description = describeDataDirPlan(planned.plan, { current: dataDir, target: dir })
    if (!description.ok) {
      showToast(description.message, 'error', 8000)
      return
    }
    const accepted = await confirm({
      message: description.message,
      title: description.title,
      confirmText: description.confirmText,
      cancelText: '取消'
    })
    if (!accepted) return
    const scheduled = await window.api.config.scheduleDataDirChange(dir, description.copy)
    if (!scheduled.ok) {
      showToast('没有能够安排这次更改，数据目录没有更改。请重新选择。', 'error', 8000)
      return
    }
    setPending(scheduled.pending)
    const restart = await confirm({
      message: '已安排好。下次启动软件时才会执行，现在要关闭软件吗？（关闭前会先保存正在编辑的内容）',
      title: '下次启动时生效',
      confirmText: '立即关闭',
      cancelText: '稍后自己关闭'
    })
    if (restart) window.api.window.close() // Close app, expect user to reopen
  }

  const cancelPending = async () => {
    const result = await window.api.config.cancelDataDirChange()
    if (result.ok) {
      setPending(null)
      showToast('已取消更改数据目录。', 'info')
    } else {
      showToast('取消失败，请重试。', 'error')
    }
  }

  const rebuildIndex = async () => {
    showToast('正在重建索引...', 'info')
    await refreshDates()
    showToast('刷新完成', 'success')
  }

  return (
    <div className="settings-card" hidden={hidden}>
      <div className="settings-card-title">数据存储</div>
      <div className="settings-card-desc">所有记录数据均在本地存储为 JSON 文件。</div>

      <div className="settings-row" onClick={pickDataDir} style={{ cursor: 'pointer' }}>
        <div className="settings-row-text">
          <span className="settings-row-label">数据根目录</span>
          <span className="settings-row-value">{dataDir}</span>
        </div>
        <button className="btn btn-ghost btn-sm">更改目录</button>
      </div>
      {pending && (
        <div className="settings-row" data-testid="pending-data-dir">
          <div className="settings-row-text">
            <span className="settings-row-label">已安排：下次启动时{pending.copy ? '复制数据到' : '改用'}</span>
            <span className="settings-row-value">{pending.to}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cancelPending}>取消更改</button>
        </div>
      )}
      <div className="settings-row" onClick={() => window.api.shell.showItemInFolder(dataDir)} style={{ cursor: 'pointer' }}>
        <div className="settings-row-text">
          <span className="settings-row-label">在资源管理器中打开</span>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm">↗</button>
      </div>
      <div className="settings-row">
        <div className="settings-row-text">
          <span className="settings-row-label">数据索引</span>
          <span className="settings-row-value">如果外部修改了文件，可手动刷新索引</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={rebuildIndex}>重建索引</button>
      </div>
    </div>
  )
}

// Backups, export / import and the automatic history.
function BackupCard({ hidden, onOpenHistory }) {
  const { backups, backingUp, exporting, importing, createBackup, exportData, importData } = useBackups()

  return (
    <div className="settings-card" hidden={hidden}>
      <div className="settings-card-title">备份与导入导出</div>
      <div className="settings-card-desc">导出 ZIP 包含所有数据与配置。最多保留 30 份本地备份。</div>
      <div className="settings-card-desc">自动历史只保存变化的文件，压缩并去重，保留最近 20 个版本及近 24 小时、30 天的代表版本，压缩内容总容量上限 200 MB。便签删除前也会保存，可恢复为新副本。</div>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={onOpenHistory}>查看自动历史</button>
        <button className="btn btn-primary" onClick={createBackup} disabled={backingUp}>
          {backingUp ? '备份中...' : '立即备份到本地'}
        </button>
        <button className="btn btn-secondary" onClick={exportData} disabled={exporting}>
          {exporting ? '导出中...' : '导出 ZIP'}
        </button>
        <button className="btn btn-secondary" onClick={importData} disabled={importing}>
          {importing ? '导入中...' : '导入 ZIP (覆盖)'}
        </button>
      </div>

      {backups.length > 0 && (
        <div className="backup-list">
          <div className="backup-list-title">本地备份记录 ({backups.length}/30)</div>
          {backups.map(b => (
            <div key={b.name} className="backup-item">
              <span className="backup-name">{b.name}</span>
              <div className="backup-meta">
                <span className="backup-size">{(b.size / 1024).toFixed(1)} KB</span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.api.shell.showItemInFolder(b.path)}>↗</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DataCards({ hidden, onOpenHistory }) {
  return (
    <>
      <StorageCard hidden={hidden} />
      <BackupCard hidden={hidden} onOpenHistory={onOpenHistory} />
    </>
  )
}
