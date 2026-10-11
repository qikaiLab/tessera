import React, { useState, useEffect, useRef } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { useApp } from '../context/AppContext'
import {
  INTERFACE_STYLE_IDS,
  SELECTABLE_INTERFACE_STYLES,
  THEME_ACCENT_OPTIONS
} from '../theme/appearanceRegistry'
import { APPEARANCE_MESSAGE_KEYS, appearanceText } from '../theme/appearanceMessages'
import {
  INTERFACE_FONT_OPTIONS,
  INTERFACE_WEIGHT_OPTIONS,
  INTERFACE_ZOOM
} from '../theme/interfacePreferences'
import defaultStylePreview from '../assets/themes/default-preview.webp'
import linenStylePreview from '../assets/themes/linen-preview.webp'
import jadeStylePreview from '../assets/themes/jade-preview.webp'
import frostedStylePreview from '../assets/themes/frosted-glass-preview.webp'
import { defaultFrostedBackground } from '../theme/frostedGlassBackground'
import { FROSTED_BACKGROUND_BLUR } from '../theme/frostedGlassPreferences'
import './Settings.css'
import JSZip from 'jszip'
import AutomaticHistory from '../components/AutomaticHistory'
import SelectMenu from '../components/SelectMenu'

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
const SETTINGS_TABS = Object.freeze([
  { id: 'appearance', label: '外观' },
  { id: 'sections', label: '数据版块' },
  { id: 'editor', label: '编辑器' },
  { id: 'data', label: '数据与备份' }
])
const SETTINGS_TAB_STORAGE_KEY = 'mototrace_settings_tab'

function readStoredSettingsTab() {
  try {
    const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)
    return SETTINGS_TABS.some(tab => tab.id === stored) ? stored : SETTINGS_TABS[0].id
  } catch {
    return SETTINGS_TABS[0].id
  }
}

const NUMBER_DEFAULT_MODE_MANUAL = 'manual'
const NUMBER_DEFAULT_MODE_CARRY = 'carry'

const STYLE_PREVIEW_BY_ID = Object.freeze({
  [INTERFACE_STYLE_IDS.DEFAULT]: defaultStylePreview,
  [INTERFACE_STYLE_IDS.LINEN_STUDY]: linenStylePreview,
  [INTERFACE_STYLE_IDS.JADE_ARCHIVE]: jadeStylePreview,
  [INTERFACE_STYLE_IDS.FROSTED_GLASS]: frostedStylePreview
})

const getNumberDefaultMode = (section) => {
  return section?.numberDefaultMode === NUMBER_DEFAULT_MODE_CARRY
    ? NUMBER_DEFAULT_MODE_CARRY
    : NUMBER_DEFAULT_MODE_MANUAL
}

export default function Settings() {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(readStoredSettingsTab)
  const selectTab = (id) => {
    setActiveTab(id)
    try { localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, id) } catch { /* remembering the tab is optional */ }
  }
  const {
    sections, saveSections, loadSections, reloadMetadata, dataDir, setDataDir, showToast, refreshDates, datesWithData, readDayData,
    fullscreenStandardWidth, updateFullscreenStandardWidth,
    fullscreenWideWidth, updateFullscreenWideWidth,
    editorLineHeight, updateEditorLineHeight,
    editorLetterSpacing, updateEditorLetterSpacing,
    interfaceStyle, updateInterfaceStyle,
    themeAccent, updateThemeAccent,
    frostedBackgroundUrl, importFrostedBackground, clearFrostedBackground,
    frostedBackgroundBlur, updateFrostedBackgroundBlur,
    interfaceZoom, updateInterfaceZoom,
    interfaceFont, updateInterfaceFont,
    interfaceWeight, updateInterfaceWeight,
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
  const [interfaceZoomDraft, setInterfaceZoomDraft] = useState(interfaceZoom)
  const [frostedBackgroundBusy, setFrostedBackgroundBusy] = useState(false)
  const interfaceZoomPointerActiveRef = useRef(false)

  useEffect(() => { loadBackups() }, [])
  useEffect(() => {
    if (!interfaceZoomPointerActiveRef.current) setInterfaceZoomDraft(interfaceZoom)
  }, [interfaceZoom])

  const handleInterfaceZoomChange = (event) => {
    const nextZoom = Number(event.currentTarget.value)
    setInterfaceZoomDraft(nextZoom)
    if (!interfaceZoomPointerActiveRef.current) updateInterfaceZoom(nextZoom)
  }

  const commitInterfaceZoomDrag = (value) => {
    if (!interfaceZoomPointerActiveRef.current) return
    interfaceZoomPointerActiveRef.current = false
    const nextZoom = Number(value)
    setInterfaceZoomDraft(nextZoom)
    updateInterfaceZoom(nextZoom)
  }

  const cancelInterfaceZoomDrag = () => {
    interfaceZoomPointerActiveRef.current = false
    setInterfaceZoomDraft(interfaceZoom)
  }

  const loadBackups = async () => {
    const list = await window.api.backup.list()
    setBackups(list)
  }

  // Section DnD
  const sensors = useSensors(
    // A plain click on the handle must not start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event
    // Dropping outside every row leaves `over` empty: nothing to reorder.
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.id === active.id)
      const newIndex = sections.findIndex(s => s.id === over.id)
      const next = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }))
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
      const confirmed = await confirm({
        title: '导入数据',
        message: '导入会用压缩包里的内容覆盖同名文件（相同日期的记录、便签、版块与图表设置等）；压缩包里没有的现有数据不会被删除。被覆盖的文件会先存入自动历史。\n是否继续导入？',
        confirmText: '继续导入'
      })
      if (!confirmed) return
      setImporting(true)
      showToast('正在读取...', 'info')
      const r = await window.api.import.readFile(filePath)
      if (r.ok) {
        try {
          const zip = await JSZip.loadAsync(r.data, { base64: true })
          let count = 0
          const failed = []
          for (const [path, file] of Object.entries(zip.files)) {
            if (!file.dir && path.endsWith('.json') && !path.startsWith('backups/')) {
              const text = await file.async('string')
              const written = await window.api.fs.writeFile(path, text)
              if (written.ok) count++
              else failed.push(path)
            }
          }
          // Reload what the app keeps in memory; otherwise the next save would write the
          // old sections / charts / favorites back over the imported files.
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
  }

  const manualRefresh = async () => {
    showToast('正在重建索引...', 'info')
    await refreshDates()
    showToast('刷新完成', 'success')
  }

  const handleFrostedBackgroundImport = async () => {
    setFrostedBackgroundBusy(true)
    try {
      const result = await importFrostedBackground()
      if (result.ok && !result.canceled) showToast('雾化玻璃背景已更新', 'success')
      else if (!result.ok) showToast(result.error || '背景图片导入失败', 'error')
    } finally {
      setFrostedBackgroundBusy(false)
    }
  }

  const handleFrostedBackgroundClear = async () => {
    setFrostedBackgroundBusy(true)
    try {
      const result = await clearFrostedBackground()
      if (result.ok) showToast('已恢复系统默认背景', 'success')
      else showToast(result.error || '恢复默认背景失败', 'error')
    } finally {
      setFrostedBackgroundBusy(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <span className="page-title">设置</span>
      </div>
      <div className="settings-scroll">
      <div className="settings-content">
        <div className="settings-tabs segmented-control" role="tablist" aria-label="设置分类">
          {SETTINGS_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={`segmented-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-card appearance-settings-card" hidden={activeTab !== 'appearance'}>
          <div className="settings-card-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.sectionTitle)}</div>
          <div className="settings-card-desc">{appearanceText(APPEARANCE_MESSAGE_KEYS.sectionDescription)}</div>

          <div className="appearance-style-grid" role="radiogroup" aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.sectionTitle)}>
            {SELECTABLE_INTERFACE_STYLES.map(style => {
              const selected = style.id === interfaceStyle
              return (
                <button
                  key={style.id}
                  type="button"
                  className={`appearance-style-option ${selected ? 'selected' : ''}`}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateInterfaceStyle(style.id)}
                >
                  <img
                    className="appearance-style-preview"
                    src={STYLE_PREVIEW_BY_ID[style.id]}
                    alt=""
                    draggable="false"
                  />
                  <span className="appearance-style-copy">
                    <span className="appearance-style-name">{appearanceText(style.labelKey)}</span>
                    <span className="appearance-style-description">{appearanceText(style.descriptionKey)}</span>
                  </span>
                  <span className="appearance-style-check" aria-hidden="true">✓</span>
                </button>
              )
            })}
          </div>

          {interfaceStyle === INTERFACE_STYLE_IDS.DEFAULT ? (
            <div className="appearance-accent-panel">
              <div className="appearance-accent-copy">
                <span className="appearance-accent-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.themeColorTitle)}</span>
                <span className="appearance-accent-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.themeColorDescription)}</span>
              </div>
              <div className="appearance-accent-options" role="radiogroup" aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.themeColorTitle)}>
                {THEME_ACCENT_OPTIONS.map(accent => {
                  const label = appearanceText(accent.labelKey)
                  const selected = accent.id === themeAccent
                  return (
                    <button
                      key={accent.id}
                      type="button"
                      className={`appearance-accent-option ${selected ? 'selected' : ''}`}
                      style={{ '--accent-preview': accent.preview }}
                      role="radio"
                      aria-checked={selected}
                      aria-label={label}
                      title={label}
                      onClick={() => updateThemeAccent(accent.id)}
                    >
                      <span className="appearance-accent-swatch" aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {interfaceStyle === INTERFACE_STYLE_IDS.FROSTED_GLASS ? (
            <div className="appearance-background-panel">
              <div className="appearance-background-preview">
                <img
                  src={frostedBackgroundUrl || defaultFrostedBackground}
                  alt=""
                  draggable="false"
                />
                <span className="appearance-background-glass-sample" aria-hidden="true">
                  MotoTrace
                </span>
              </div>
              <div className="appearance-background-content">
                <div className="appearance-background-copy">
                  <span className="appearance-accent-title">
                    {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundTitle)}
                  </span>
                  <span className="appearance-accent-description">
                    {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundDescription)}
                  </span>
                  <span className="appearance-background-status">
                    {appearanceText(frostedBackgroundUrl
                      ? APPEARANCE_MESSAGE_KEYS.frostedBackgroundCustom
                      : APPEARANCE_MESSAGE_KEYS.frostedBackgroundDefault)}
                  </span>
                </div>
                <div className="appearance-background-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={frostedBackgroundBusy}
                    onClick={handleFrostedBackgroundImport}
                  >
                    {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundImport)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={frostedBackgroundBusy || !frostedBackgroundUrl}
                    onClick={handleFrostedBackgroundClear}
                  >
                    {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBackgroundRestore)}
                  </button>
                </div>
                <div className="appearance-background-blur-control">
                  <div className="appearance-background-blur-copy">
                    <span className="appearance-accent-title">
                      {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurTitle)}
                    </span>
                    <span className="appearance-accent-description">
                      {appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurDescription)}
                    </span>
                  </div>
                  <div className="appearance-background-blur-slider-row">
                    <input
                      className="appearance-background-blur-slider"
                      type="range"
                      min={FROSTED_BACKGROUND_BLUR.MIN}
                      max={FROSTED_BACKGROUND_BLUR.MAX}
                      step={FROSTED_BACKGROUND_BLUR.STEP}
                      value={frostedBackgroundBlur}
                      onChange={event => updateFrostedBackgroundBlur(event.currentTarget.value)}
                      aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.frostedBlurTitle)}
                      aria-valuetext={frostedBackgroundBlur === 0 ? '不虚化' : `${frostedBackgroundBlur} 像素`}
                    />
                    <output className="appearance-background-blur-value" aria-live="polite">
                      {frostedBackgroundBlur === 0 ? '无' : `${frostedBackgroundBlur}px`}
                    </output>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="settings-card interface-display-card" hidden={activeTab !== 'appearance'}>
          <div className="settings-card-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.displaySectionTitle)}</div>
          <div className="settings-card-desc">{appearanceText(APPEARANCE_MESSAGE_KEYS.displaySectionDescription)}</div>

          <div className="interface-preference-panel">
            <div className="interface-preference-row interface-zoom-row">
              <div className="interface-preference-copy">
                <span className="interface-preference-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.zoomTitle)}</span>
                <span className="interface-preference-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.zoomDescription)}</span>
              </div>
              <div className="interface-zoom-control">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm interface-zoom-button"
                  onClick={() => updateInterfaceZoom(interfaceZoom - INTERFACE_ZOOM.STEP)}
                  disabled={interfaceZoom <= INTERFACE_ZOOM.MIN}
                  aria-label="缩小界面"
                >
                  −
                </button>
                <input
                  className="interface-zoom-slider"
                  type="range"
                  min={INTERFACE_ZOOM.MIN}
                  max={INTERFACE_ZOOM.MAX}
                  step={INTERFACE_ZOOM.STEP}
                  value={interfaceZoomDraft}
                  onPointerDown={() => { interfaceZoomPointerActiveRef.current = true }}
                  onChange={handleInterfaceZoomChange}
                  onPointerUp={event => commitInterfaceZoomDrag(event.currentTarget.value)}
                  onPointerCancel={cancelInterfaceZoomDrag}
                  onBlur={event => commitInterfaceZoomDrag(event.currentTarget.value)}
                  aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.zoomTitle)}
                  aria-valuetext={`${interfaceZoomDraft}%`}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm interface-zoom-button"
                  onClick={() => updateInterfaceZoom(interfaceZoom + INTERFACE_ZOOM.STEP)}
                  disabled={interfaceZoom >= INTERFACE_ZOOM.MAX}
                  aria-label="放大界面"
                >
                  +
                </button>
                <output className="interface-zoom-value" aria-live="polite">{interfaceZoomDraft}%</output>
              </div>
            </div>

            <div className="interface-preference-row">
              <div className="interface-preference-copy">
                <span className="interface-preference-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.fontTitle)}</span>
                <span className="interface-preference-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.fontDescription)}</span>
              </div>
              <div className="interface-preference-select">
                <SelectMenu
                  ariaLabel="软件字体"
                  options={INTERFACE_FONT_OPTIONS.map(option => ({ value: option.id, label: appearanceText(option.labelKey) }))}
                  value={interfaceFont}
                  onChange={updateInterfaceFont}
                />
              </div>
            </div>

            <div className="interface-preference-row">
              <div className="interface-preference-copy">
                <span className="interface-preference-title">{appearanceText(APPEARANCE_MESSAGE_KEYS.weightTitle)}</span>
                <span className="interface-preference-description">{appearanceText(APPEARANCE_MESSAGE_KEYS.weightDescription)}</span>
              </div>
              <div className="interface-weight-options" role="radiogroup" aria-label={appearanceText(APPEARANCE_MESSAGE_KEYS.weightTitle)}>
                {INTERFACE_WEIGHT_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={`interface-weight-option ${interfaceWeight === option.id ? 'selected' : ''}`}
                    role="radio"
                    aria-checked={interfaceWeight === option.id}
                    onClick={() => updateInterfaceWeight(option.id)}
                  >
                    {appearanceText(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Section Management */}
        <div className="settings-card" hidden={activeTab !== 'sections'}>
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
            <div className="add-section-type">
              <SelectMenu
                ariaLabel="版块类型"
                options={[{ value: 'text', label: '文字' }, { value: 'number', label: '数字' }]}
                value={newSectionType}
                onChange={setNewSectionType}
              />
            </div>
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
                <div className="section-default-mode-select">
                  <SelectMenu
                    ariaLabel="数字默认填充方式"
                    options={[
                      { value: NUMBER_DEFAULT_MODE_MANUAL, label: '每日手动输入，默认 0' },
                      { value: NUMBER_DEFAULT_MODE_CARRY, label: '延续前一日数据' }
                    ]}
                    value={newSectionNumberDefaultMode}
                    onChange={setNewSectionNumberDefaultMode}
                  />
                </div>
              </>
            )}
            <button className="btn btn-secondary" type="submit">添加版块</button>
          </form>
        </div>

        {/* Editor Typesetting Settings */}
        <div className="settings-card animate-fade-in" hidden={activeTab !== 'editor'}>
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
        <div className="settings-card" hidden={activeTab !== 'data'}>
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
        <div className="settings-card" hidden={activeTab !== 'data'}>
          <div className="settings-card-title">备份与导入导出</div>
          <div className="settings-card-desc">导出 ZIP 包含所有数据与配置。最多保留 30 份本地备份。</div>
          <div className="settings-card-desc">自动历史只保存变化的文件，压缩并去重，保留最近 20 个版本及近 24 小时、30 天的代表版本，压缩内容总容量上限 200 MB。便签删除前也会保存，可恢复为新副本。</div>
          
          <div className="settings-actions">
            <button className="btn btn-secondary" onClick={() => setHistoryOpen(true)}>查看自动历史</button>
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

      {historyOpen && <AutomaticHistory onClose={() => setHistoryOpen(false)} />}
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
          <div
            className="section-default-mode-select section-default-mode-select--compact"
            onPointerDown={e => e.stopPropagation()}
            title="数字默认填充方式"
          >
            <SelectMenu
              ariaLabel={`${section.name}的数字默认填充方式`}
              options={[
                { value: NUMBER_DEFAULT_MODE_MANUAL, label: '每日手动输入' },
                { value: NUMBER_DEFAULT_MODE_CARRY, label: '延续前一日' }
              ]}
              value={getNumberDefaultMode(section)}
              onChange={onChangeNumberDefaultMode}
            />
          </div>
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
