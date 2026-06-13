import React, { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { useApp } from '../context/AppContext'
import './Settings.css'
import JSZip from 'jszip'

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
const NUMBER_DEFAULT_MODE_MANUAL = 'manual'
const NUMBER_DEFAULT_MODE_CARRY = 'carry'

const getNumberDefaultMode = (section) => {
  return section?.numberDefaultMode === NUMBER_DEFAULT_MODE_CARRY
    ? NUMBER_DEFAULT_MODE_CARRY
    : NUMBER_DEFAULT_MODE_MANUAL
}

export default function Settings() {
  const {
    sections, saveSections, dataDir, setDataDir, showToast, refreshDates, datesWithData, readDayData,
    fullscreenStandardWidth, updateFullscreenStandardWidth,
    fullscreenWideWidth, updateFullscreenWideWidth,
    editorLineHeight, updateEditorLineHeight,
    editorLetterSpacing, updateEditorLetterSpacing,
    confirm
  } = useApp()
  const [backups, setBackups] = useState([])
  const [backingUp, setBackingUp] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newSectionType, setNewSectionType] = useState('text')
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionUnit, setNewSectionUnit] = useState('')
  const [newSectionColor, setNewSectionColor] = useState('#7c6aff')
  const [newSectionNumberDefaultMode, setNewSectionNumberDefaultMode] = useState(NUMBER_DEFAULT_MODE_MANUAL)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, sec: null, hasData: false, checking: false })

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
      numberDefaultMode: newSectionType === 'number' ? newSectionNumberDefaultMode : undefined,
      color: newSectionColor,
      resident: false,
      order: sections.length
    }
    await saveSections([...sections, sec])
    setNewSectionName('')
    setNewSectionUnit('')
    setNewSectionColor('#7c6aff')
    setNewSectionNumberDefaultMode(NUMBER_DEFAULT_MODE_MANUAL)
    showToast('已添加新数据版块', 'success')
  }

  const handleDeleteClick = async (id) => {
    const sec = sections.find(s => s.id === id)
    if (!sec) return
    
    setDeleteModalState({ isOpen: true, sec, hasData: false, checking: true })
    
    // Check historical data
    let foundData = false
    for (const dStr of datesWithData) {
      const dayData = await readDayData(dStr)
      const val = dayData[id]?.value
      if (val !== undefined && val !== null && val !== '') {
        foundData = true
        break
      }
    }
    setDeleteModalState({ isOpen: true, sec, hasData: foundData, checking: false })
  }

  const confirmDelete = async () => {
    const { sec } = deleteModalState
    if (sec) {
      await saveSections(sections.filter(s => s.id !== sec.id))
      showToast('已删除版块', 'success')
    }
    setDeleteModalState({ isOpen: false, sec: null, hasData: false, checking: false })
  }

  const toggleResident = async (id) => {
    const next = sections.map(s => s.id === id ? { ...s, resident: !s.resident } : s)
    await saveSections(next)
  }

  const changeSectionColor = async (id, color) => {
    const next = sections.map(s => s.id === id ? { ...s, color } : s)
    await saveSections(next)
  }

  const renameSection = async (id, newName) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const next = sections.map(s => s.id === id ? { ...s, name: trimmed } : s)
    await saveSections(next)
    showToast('已重命名版块', 'success')
  }

  const changeSectionNumberDefaultMode = async (id, mode) => {
    const normalizedMode = mode === NUMBER_DEFAULT_MODE_CARRY ? NUMBER_DEFAULT_MODE_CARRY : NUMBER_DEFAULT_MODE_MANUAL
    const next = sections.map(s => (
      s.id === id && s.type === 'number'
        ? { ...s, numberDefaultMode: normalizedMode }
        : s
    ))
    await saveSections(next)
  }

  // Data Directory
  const pickDataDir = async () => {
    const dir = await window.api.dialog.openDirectory()
    if (dir) {
      await window.api.config.setDataDir(dir)
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
  }

  // Backup
  const createBackup = async () => {
    setBackingUp(true)
    showToast('正在备份...', 'info')
    const result = await window.api.backup.create()
    if (result.ok && result.files.length > 0) {
      const zip = new JSZip()
      result.files.forEach(f => zip.file(f.path, f.content))
      const content = await zip.generateAsync({ type: 'base64' })
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
        const content = await zip.generateAsync({ type: 'base64' })
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
          const zip = await JSZip.loadAsync(r.data, { base64: true })
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
                    onChangeColor={(color) => changeSectionColor(sec.id, color)}
                    onRename={(name) => renameSection(sec.id, name)}
                    onChangeNumberDefaultMode={(mode) => changeSectionNumberDefaultMode(sec.id, mode)}
                    onDelete={() => handleDeleteClick(sec.id)}
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
            <label className="color-swatch-btn color-swatch-btn--lg" title="设定版块主题色" style={{ '--swatch-color': newSectionColor }}>
              <input
                type="color"
                value={newSectionColor}
                onChange={e => setNewSectionColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                tabIndex={-1}
              />
              <span className="color-swatch-circle" style={{ background: newSectionColor }} />
            </label>
            <input
              className="input flex-1"
              placeholder="版块名称 (如: 阅读, 体重...)"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              required
            />
            {newSectionType === 'number' && (
              <>
              <input
                className="input"
                placeholder="单位 (如: kg, min)"
                value={newSectionUnit}
                onChange={e => setNewSectionUnit(e.target.value)}
                style={{ width: 100 }}
              />
                <select
                  className="input section-default-mode-select"
                  value={newSectionNumberDefaultMode}
                  onChange={e => setNewSectionNumberDefaultMode(e.target.value)}
                  title="数字默认填充方式"
                >
                  <option value={NUMBER_DEFAULT_MODE_MANUAL}>每日手动输入，默认 0</option>
                  <option value={NUMBER_DEFAULT_MODE_CARRY}>延续前一日数据</option>
                </select>
              </>
            )}
            <button className="btn btn-secondary" type="submit">添加版块</button>
          </form>
        </div>

        {/* Editor Typesetting Settings */}
        <div className="settings-card animate-fade-in">
          <div className="settings-card-title">编辑器排版设置</div>
          <div className="settings-card-desc">自定义日记与文本编辑器在沉浸式全屏及常规模式下的排版显示效果。</div>
          
          <div className="settings-typesetting-grid">
            <div className="settings-field">
              <label className="settings-field-label">标准行宽 (标准模式)</label>
              <input
                className="input settings-field-input"
                type="text"
                placeholder="700px"
                value={fullscreenStandardWidth}
                onChange={e => updateFullscreenStandardWidth(e.target.value)}
              />
              <span className="settings-field-tip">全屏模式下的常规宽度 (例如: 700px)</span>
            </div>

            <div className="settings-field">
              <label className="settings-field-label">宽屏行宽 (宽屏模式)</label>
              <input
                className="input settings-field-input"
                type="text"
                placeholder="1000px"
                value={fullscreenWideWidth}
                onChange={e => updateFullscreenWideWidth(e.target.value)}
              />
              <span className="settings-field-tip">全屏模式下的宽幅宽度 (例如: 1000px 或 90%)</span>
            </div>

            <div className="settings-field">
              <label className="settings-field-label">行间距 (行高比例)</label>
              <input
                className="input settings-field-input"
                type="text"
                placeholder="1.8"
                value={editorLineHeight}
                onChange={e => updateEditorLineHeight(e.target.value)}
              />
              <span className="settings-field-tip">正文行高比例 (无单位数值，如: 1.8)</span>
            </div>

            <div className="settings-field">
              <label className="settings-field-label">字间距 (字元额外间距)</label>
              <input
                className="input settings-field-input"
                type="text"
                placeholder="0px"
                value={editorLetterSpacing}
                onChange={e => updateEditorLetterSpacing(e.target.value)}
              />
              <span className="settings-field-tip">字与字之间的间距 (支持 em/px，如: 0.02em 或 0.5px，默认 0px)</span>
            </div>
          </div>
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

      {/* Delete Modal */}
      {deleteModalState.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModalState({ isOpen: false })}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">删除版块确认</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteModalState({ isOpen: false })}>✕</button>
            </div>
            <div style={{ marginBottom: 20 }}>
              {deleteModalState.checking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>正在检查历史记录...</span>
                </div>
              ) : deleteModalState.hasData ? (
                <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  <p style={{ color: 'var(--error)', fontWeight: 'bold', marginBottom: 8 }}>无法删除此版块！</p>
                  <p>我们在您的历史记录中发现了属于 <b>{deleteModalState.sec?.name}</b> 的数据。</p>
                  <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>
                    为了保证历史数据的完整性，包含已有记录的版块禁止被删除。如果您不想在今日记录中看到它，请将其 <b>「取消常驻」</b>。
                  </p>
                </div>
              ) : (
                <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  <p>确定要删除版块 <b>{deleteModalState.sec?.name}</b> 吗？</p>
                  <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>此版块没有关联的历史数据，可以安全删除。删除后无法恢复。</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setDeleteModalState({ isOpen: false })}>
                {deleteModalState.hasData ? '知道了' : '取消'}
              </button>
              {!deleteModalState.checking && !deleteModalState.hasData && (
                <button className="btn btn-primary" style={{ background: 'var(--error)' }} onClick={confirmDelete}>
                  确定删除
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableSection({ section, onToggleResident, onChangeColor, onRename, onChangeNumberDefaultMode, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(section.name)
  const inputRef = React.useRef(null)

  // Keep editName in sync if section.name changes externally
  React.useEffect(() => { setEditName(section.name) }, [section.name])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    boxShadow: isDragging ? 'var(--shadow-md)' : 'none',
  }

  const startEdit = () => {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }

  const commitEdit = () => {
    setEditing(false)
    if (editName.trim() && editName.trim() !== section.name) {
      onRename(editName.trim())
    } else {
      setEditName(section.name)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { setEditing(false); setEditName(section.name) }
  }

  return (
    <div ref={setNodeRef} style={style} className={`settings-section-item ${isDragging ? 'dragging' : ''}`}>
      <div className="drag-handle" {...attributes} {...listeners}>☷</div>
      <div className="sec-item-info">
        {editing ? (
          <input
            ref={inputRef}
            className="input sec-item-name-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className="sec-item-name sec-item-name-editable"
            onClick={startEdit}
            title="点击重命名"
          >
            {section.name}
            <span className="sec-rename-icon">✎</span>
          </span>
        )}
        <span className="sec-item-type">{section.type === 'text' ? '📝 文字' : `🔢 数字 ${section.unit ? `[${section.unit}]` : ''}`}</span>
      </div>
      <div className="sec-item-actions">
        {section.type === 'number' && (
          <select
            className="input section-default-mode-select section-default-mode-select--compact"
            value={getNumberDefaultMode(section)}
            onChange={e => onChangeNumberDefaultMode(e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            title="数字默认填充方式"
          >
            <option value={NUMBER_DEFAULT_MODE_MANUAL}>每日手动输入</option>
            <option value={NUMBER_DEFAULT_MODE_CARRY}>延续前一日</option>
          </select>
        )}
        <label className="color-swatch-btn" title="修改版块颜色" style={{ '--swatch-color': section.color || '#7c6aff' }}>
          <input
            type="color"
            value={section.color || '#7c6aff'}
            onChange={e => onChangeColor(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            tabIndex={-1}
          />
          <span className="color-swatch-circle" style={{ background: section.color || '#7c6aff' }} />
        </label>
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
