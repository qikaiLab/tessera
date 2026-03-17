import React, { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { useApp } from '../context/AppContext'
import './Settings.css'
import JSZip from 'jszip'

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

export default function Settings() {
  const { sections, saveSections, dataDir, setDataDir, showToast, refreshDates } = useApp()
  const [backups, setBackups] = useState([])
  const [backingUp, setBackingUp] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newSectionType, setNewSectionType] = useState('text')
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionUnit, setNewSectionUnit] = useState('')

  useEffect(() => { loadBackups() }, [])

  const loadBackups = async () => {
    const list = await window.api.backup.list()
    setBackups(list)
  }

  // Section DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.id === active.id)
      const newIndex = sections.findIndex(s => s.id === over.id)
      const next = arrayMove(sections, oldIndex, newIndex)
      next.forEach((s, i) => s.order = i)
      await saveSections(next)
    }
  }

  const addSection = async (e) => {
    e.preventDefault()
    if (!newSectionName.trim()) return
    const sec = {
      id: generateId(),
      name: newSectionName.trim(),
      type: newSectionType,
      unit: newSectionType === 'number' ? newSectionUnit.trim() : '',
      resident: false,
      order: sections.length
    }
    await saveSections([...sections, sec])
    setNewSectionName('')
    setNewSectionUnit('')
    showToast('已添加新数据版块', 'success')
  }

  const deleteSection = async (id) => {
    const sec = sections.find(s => s.id === id)
    if (!confirm(`确定要删除版块「${sec.name}」吗？\n注意：如果已有旧数据依赖此版块，您应该将其[取消常驻]而不是删除，否则查看旧数据时将无法显示其名称。`)) return
    await saveSections(sections.filter(s => s.id !== id))
    showToast('已删除', 'info')
  }

  const toggleResident = async (id) => {
    const next = sections.map(s => s.id === id ? { ...s, resident: !s.resident } : s)
    await saveSections(next)
  }

  // Data Directory
  const pickDataDir = async () => {
    const dir = await window.api.dialog.openDirectory()
    if (dir) {
      await window.api.config.setDataDir(dir)
      const confirmed = confirm('已更改数据目录，是否立即重启软件以加载新目录的数据？')
      if (confirmed) {
        window.api.window.close() // Close app, expect user to reopen
      }
    }
  }

  // Backup
  const createBackup = async () => {
    setBackingUp(true)
    showToast('正在备份...', 'info')
    const result = await window.api.backup.create()
    if (result.ok && result.files.length > 0) {
      const zip = new JSZip()
      result.files.forEach(f => zip.file(f.path, f.content))
      const content = await zip.generateAsync({ type: 'uint8array' })
      const saveRes = await window.api.backup.writeZip(result.backupPath, content)
      if (saveRes.ok) {
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

  // Export
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
      const result = await window.api.backup.create()
      if (result.ok && result.files.length > 0) {
        const zip = new JSZip()
        result.files.forEach(f => zip.file(f.path, f.content))
        const content = await zip.generateAsync({ type: 'uint8array' })
        const writeRes = await window.api.export.writeFile(savePath, content)
        if (writeRes.ok) showToast('导出成功', 'success')
        else showToast('导出失败', 'error')
      }
    }
    setExporting(false)
  }

  // Import
  const importData = async () => {
    const filePath = await window.api.dialog.openFile({
      title: '导入 MotoTrace 数据',
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    })

    if (filePath) {
      setImporting(true)
      showToast('正在读取...', 'info')
      const r = await window.api.import.readFile(filePath)
      if (r.ok) {
        try {
          const zip = await JSZip.loadAsync(r.buffer)
          let count = 0
          for (const [path, file] of Object.entries(zip.files)) {
            if (!file.dir && path.endsWith('.json') && !path.startsWith('backups/')) {
              const text = await file.async('string')
              await window.api.fs.writeFile(path, text)
              count++
            }
          }
          await refreshDates()
          showToast(`导入成功，共恢复 ${count} 个文件，请重启软件加载所有数据。`, 'success', 5000)
        } catch (e) {
          showToast(`解析失败: ${e.message}`, 'error')
        }
      } else {
        showToast('读取文件失败', 'error')
      }
      setImporting(false)
    }
  }

  const manualRefresh = async () => {
    showToast('正在重建索引...', 'info')
    await refreshDates()
    showToast('刷新完成', 'success')
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <span className="page-title">设置</span>
      </div>
      <div className="settings-content">
        
        {/* Section Management */}
        <div className="settings-card">
          <div className="settings-card-title">数据版块管理</div>
          <div className="settings-card-desc">自由添加、删除和排序您的记录版块。设置为常驻的版块每天都会固定显示在最前方。<br/>拖拽左侧的 ☷ 图标可以排序。</div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="section-list">
                {sections.map(sec => (
                  <SortableSection
                    key={sec.id}
                    section={sec}
                    onToggleResident={() => toggleResident(sec.id)}
                    onDelete={() => deleteSection(sec.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <form className="add-section-form" onSubmit={addSection}>
            <select
              className="input"
              value={newSectionType}
              onChange={e => setNewSectionType(e.target.value)}
              style={{ width: 100 }}
            >
              <option value="text">文字</option>
              <option value="number">数字</option>
            </select>
            <input
              className="input flex-1"
              placeholder="版块名称 (如: 阅读, 体重...)"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              required
            />
            {newSectionType === 'number' && (
              <input
                className="input"
                placeholder="单位 (如: kg, min)"
                value={newSectionUnit}
                onChange={e => setNewSectionUnit(e.target.value)}
                style={{ width: 100 }}
              />
            )}
            <button className="btn btn-secondary" type="submit">添加版块</button>
          </form>
        </div>

        {/* Storage Management */}
        <div className="settings-card">
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
            <button className="btn btn-secondary btn-sm" onClick={manualRefresh}>重建索引</button>
          </div>
        </div>

        {/* Backup & Import/Export */}
        <div className="settings-card">
          <div className="settings-card-title">备份与导入导出</div>
          <div className="settings-card-desc">导出 ZIP 包含所有数据与配置。最多保留 30 份本地备份。</div>
          
          <div className="settings-actions">
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

      </div>
    </div>
  )
}

function SortableSection({ section, onToggleResident, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    boxShadow: isDragging ? 'var(--shadow-md)' : 'none',
  }

  return (
    <div ref={setNodeRef} style={style} className={`settings-section-item ${isDragging ? 'dragging' : ''}`}>
      <div className="drag-handle" {...attributes} {...listeners}>☷</div>
      <div className="sec-item-info">
        <span className="sec-item-name">{section.name}</span>
        <span className="sec-item-type">{section.type === 'text' ? '📝 文字' : `🔢 数字 ${section.unit ? `[${section.unit}]` : ''}`}</span>
      </div>
      <div className="sec-item-actions">
        <button
          className={`btn btn-sm ${section.resident ? 'btn-primary' : 'btn-ghost'}`}
          onClick={onToggleResident}
        >
          {section.resident ? '★ 常驻' : '☆ 常驻'}
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={onDelete}>🗑</button>
      </div>
    </div>
  )
}
