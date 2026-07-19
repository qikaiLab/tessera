import React, { useState, useEffect } from 'react'
import './ShortcutsModal.css'

const categories = [
  {
    id: 'edit',
    label: '编辑与格式',
    shortcuts: [
      { keys: ['Ctrl', 'B'], macKeys: ['⌘', 'B'], desc: '加粗文本' },
      { keys: ['Ctrl', 'I'], macKeys: ['⌘', 'I'], desc: '斜体文本' },
      { keys: ['Ctrl', 'U'], macKeys: ['⌘', 'U'], desc: '下划线文本' },
      { keys: ['Ctrl', 'Shift', 'X'], macKeys: ['⌘', '⇧', 'X'], desc: '删除线文本' },
      { keys: ['Ctrl', 'E'], macKeys: ['⌘', 'E'], desc: '行内代码' },
      { keys: ['Ctrl', '\\'], macKeys: ['⌘', '\\', '或', 'Ctrl', '\\'], desc: '清除所有字符格式' },
      { keys: ['Ctrl', 'Z'], macKeys: ['⌘', 'Z'], desc: '撤销上一次操作' },
      { keys: ['Ctrl', 'Y'], macKeys: ['⌘', 'Y'], desc: '重做（反撤销）' },
    ]
  },
  {
    id: 'format',
    label: '排版与指令',
    shortcuts: [
      { keys: ['Ctrl', 'Alt', '0'], macKeys: ['⌘', '⌥', '0'], desc: '恢复为普通文本段落' },
      { keys: ['Ctrl', 'Alt', '1...6'], macKeys: ['⌘', '⌥', '1...6'], desc: '设置为标题 1 ~ 6' },
      { keys: ['Ctrl', 'Shift', '8'], macKeys: ['⌘', '⇧', '8'], desc: '插入/切换无序列表' },
      { keys: ['Ctrl', 'Shift', '9'], macKeys: ['⌘', '⇧', '9'], desc: '插入/切换有序列表' },
      { keys: ['Ctrl', 'Shift', 'B'], macKeys: ['⌘', '⇧', 'B'], desc: '插入/切换引用块' },
      { keys: ['Ctrl', 'Alt', 'C'], macKeys: ['⌘', '⌥', 'C'], desc: '插入/切换代码块' },
      { keys: ['/'], macKeys: ['/'], desc: '在编辑区输入可调出快速插入菜单' },
    ]
  },
  {
    id: 'system',
    label: '系统与控制',
    shortcuts: [
      { keys: ['Ctrl', 'S'], macKeys: ['⌘', 'S'], desc: '手动保存当前修改' },
      { keys: ['Ctrl', 'Shift', 'Enter'], macKeys: ['⌘', '⇧', 'Enter'], desc: '进入/切换沉浸式全屏编辑' },
      { keys: ['Ctrl', 'Enter'], macKeys: ['⌘', 'Enter'], desc: '退出代码块/引用块并新建段落' },
      { keys: ['Shift', 'Enter'], macKeys: ['Shift', 'Enter'], desc: '列表项内换行或代码块换行' },
      { keys: ['F1'], macKeys: ['F1'], desc: '全局打开“使用说明”指南' },
      { keys: ['Ctrl', '/'], macKeys: ['⌘', '/'], desc: '全局打开/关闭本快捷键面板' },
      { keys: ['Ctrl', '+ / −'], macKeys: ['⌘', '+ / −'], desc: '放大或缩小整体界面' },
      { keys: ['Ctrl', '鼠标滚轮'], macKeys: ['⌘', '鼠标滚轮'], desc: '连续调整整体界面缩放' },
      { keys: ['Escape'], macKeys: ['Esc'], desc: '退出全屏写作模式 / 关闭日期跳转' },
    ]
  }
]

export default function ShortcutsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('edit')
  const isMac = window.navigator.platform.toUpperCase().indexOf('MAC') >= 0

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const renderKeys = (keys) => {
    return keys.map((key, i) => {
      if (key === '或') {
        return <span key={i} className="shortcuts-key-or">或</span>
      }
      return <kbd key={i} className="shortcut-kbd">{key}</kbd>
    })
  }

  const activeCategory = categories.find(c => c.id === activeTab)

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="shortcuts-header-title">
            <span className="shortcuts-header-icon">⌨</span>
            <h2>快捷键清单</h2>
          </div>
          <button className="shortcuts-close" onClick={onClose} title="关闭 (Esc)">✕</button>
        </div>

        <div className="shortcuts-tabs">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`shortcuts-tab ${activeTab === cat.id ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="shortcuts-content scrollable">
          <div className="shortcuts-list">
            {activeCategory?.shortcuts.map((s, idx) => (
              <div key={idx} className="shortcuts-row">
                <span className="shortcuts-desc">{s.desc}</span>
                <div className="shortcuts-keys">
                  {renderKeys(isMac ? s.macKeys : s.keys)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shortcuts-footer">
          <span className="shortcuts-hint">按 <kbd>Esc</kbd> 键可快速关闭此窗口</span>
          <button className="btn btn-primary btn-sm" onClick={onClose}>我知道了</button>
        </div>
      </div>
    </div>
  )
}
