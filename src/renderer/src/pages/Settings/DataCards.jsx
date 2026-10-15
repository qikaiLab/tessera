import { useApp } from '../../context/AppContext'
import { useBackups } from './useBackups'
import './DataCards.css'

// Where the data lives, and how to rebuild its index.
function StorageCard({ hidden }) {
  const { dataDir, setDataDir, showToast, refreshDates, confirm } = useApp()

  const pickDataDir = async () => {
    const dir = await window.api.dialog.openDirectory()
    if (!dir) return
    await window.api.config.setDataDir(dir)
    setDataDir(dir)
    const confirmed = await confirm({
      message: '已更改数据目录，是否立即重启软件以加载新目录的数据？',
      title: '需要重启',
      confirmText: '立即重启',
      cancelText: '稍后重启'
    })
    if (confirmed) {
      window.api.window.close() // Close app, expect user to reopen
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
