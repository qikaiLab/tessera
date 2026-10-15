import { useState } from 'react'

export const SETTINGS_TABS = Object.freeze([
  { id: 'appearance', label: '外观' },
  { id: 'sections', label: '数据版块' },
  { id: 'editor', label: '编辑器' },
  { id: 'data', label: '数据与备份' }
])

const STORAGE_KEY = 'mototrace_settings_tab'

function readStoredTab() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SETTINGS_TABS.some(tab => tab.id === stored) ? stored : SETTINGS_TABS[0].id
  } catch {
    return SETTINGS_TABS[0].id
  }
}

// The open tab, remembered for the next visit.
export function useSettingsTab() {
  const [activeTab, setActiveTab] = useState(readStoredTab)
  const selectTab = (id) => {
    setActiveTab(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* remembering the tab is optional */ }
  }
  return [activeTab, selectTab]
}
