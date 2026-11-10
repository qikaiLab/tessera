import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useApp } from '../../context/AppContext'
import { findInvalidArchiveEntries, readArchiveJsonEntries, zipFilesToBase64 } from '../../utils/dataArchive'

/**
 * Local backups, ZIP export and import of the data directory.
 *
 * Importing restores the JSON files of a ZIP over files with the same name, but only when every
 * file in it is sound (otherwise nothing is written), then reloads what
 * the app keeps in memory, otherwise the next save would write the old sections / charts /
 * favourites back over the imported files.
 */
export function useBackups() {
  const { showToast, confirm, refreshDates, loadSections, reloadMetadata } = useApp()
  const [backups, setBackups] = useState([])
  const [backingUp, setBackingUp] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  const loadBackups = useCallback(async () => {
    setBackups(await window.api.backup.list())
  }, [])

  useEffect(() => { loadBackups() }, [loadBackups])

  // The files of the data directory, zipped as base64; null when there is nothing to save.
  const collectArchive = async () => {
    const result = await window.api.backup.create()
    if (!result.ok || result.files.length === 0) return null
    return { backupPath: result.backupPath, content: await zipFilesToBase64(result.files) }
  }

  const createBackup = async () => {
    setBackingUp(true)
    showToast('正在备份...', 'info')
    const archive = await collectArchive()
    if (archive) {
      const saved = await window.api.backup.writeZip(archive.backupPath, archive.content)
      if (saved.ok) {
        showToast('备份成功', 'success')
        await loadBackups()
      } else {
        showToast('写入备份文件失败', 'error')
      }
    } else {
      showToast('获取文件失败或无文件', 'error')
    }
    setBackingUp(false)
  }

  const exportData = async () => {
    setExporting(true)
    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss')
    const savePath = await window.api.dialog.saveFile({
      title: '导出 MotoTrace 数据',
      defaultPath: `MotoTrace-Export-${timestamp}.zip`,
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    })

    if (savePath) {
      showToast('正在导出...', 'info')
      const archive = await collectArchive()
      if (archive) {
        const written = await window.api.export.writeFile(savePath, archive.content)
        showToast(written.ok ? '导出成功' : '导出失败', written.ok ? 'success' : 'error')
      }
    }
    setExporting(false)
  }

  const importData = async () => {
    const filePath = await window.api.dialog.openFile({
      title: '导入 MotoTrace 数据',
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    })
    if (!filePath) return

    const confirmed = await confirm({
      title: '导入数据',
      message: '导入会用压缩包里的内容覆盖同名文件（相同日期的记录、便签、版块与图表设置等）；压缩包里没有的现有数据不会被删除。被覆盖的文件会先存入自动历史。\n是否继续导入？',
      confirmText: '继续导入'
    })
    if (!confirmed) return

    setImporting(true)
    showToast('正在读取...', 'info')
    const read = await window.api.import.readFile(filePath)
    if (read.ok) {
      try {
        let count = 0
        const failed = []
        const entries = await readArchiveJsonEntries(read.data)
        if (entries.length === 0) {
          showToast('压缩包里没有可导入的数据，未做任何改动', 'error', 5000)
          setImporting(false)
          return
        }
        const invalid = findInvalidArchiveEntries(entries)
        if (invalid.length > 0) {
          showToast(`压缩包中有 ${invalid.length} 个文件已损坏或路径不安全（如 ${invalid[0].path}），未导入任何内容，现有数据没有改动`, 'error', 8000)
          setImporting(false)
          return
        }
        for (const { path, text } of entries) {
          const written = await window.api.fs.writeFile(path, text)
          if (written.ok) count++
          else failed.push(path)
        }
        await Promise.all([refreshDates(), loadSections(), reloadMetadata()])
        if (failed.length > 0) {
          showToast(`已恢复 ${count} 个文件，${failed.length} 个文件写入失败（如 ${failed[0]}）`, 'error', 6000)
        } else {
          showToast(`导入成功，共恢复 ${count} 个文件。`, 'success', 4000)
        }
      } catch (e) {
        showToast(`解析失败: ${e.message}`, 'error')
      }
    } else {
      showToast('读取文件失败', 'error')
    }
    setImporting(false)
  }

  return { backups, backingUp, exporting, importing, createBackup, exportData, importData }
}
