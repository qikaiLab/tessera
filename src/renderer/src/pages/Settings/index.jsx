import { useState } from 'react'
import AutomaticHistory from '../../components/AutomaticHistory'
import Presence from '../../components/Presence'
import { useSlidingThumb } from '../../utils/useSlidingThumb'
import AppearanceCard from './AppearanceCard'
import DataCards from './DataCards'
import DeleteSectionDialog from './DeleteSectionDialog'
import DisplayCard from './DisplayCard'
import EditorCard from './EditorCard'
import SectionsCard from './SectionsCard'
import { SETTINGS_TABS, useSettingsTab } from './settingsTabs'
import { useSectionDeletion } from './useSectionDeletion'
import './Settings.css'

// The settings page: a tab strip over cards. Every card stays mounted and the inactive ones are
// only hidden, so a half-edited field survives switching tabs.
export default function Settings() {
  const tabsThumbRef = useSlidingThumb()
  const [activeTab, selectTab] = useSettingsTab()
  const [historyOpen, setHistoryOpen] = useState(false)
  const deletion = useSectionDeletion()

  return (
    <div className="settings-page">
      <div className="page-header">
        <span className="page-title">设置</span>
      </div>
      <div className="settings-scroll">
        <div className="settings-content">
          <div className="settings-tabs segmented-control" role="tablist" aria-label="设置分类" ref={tabsThumbRef}>
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

          <AppearanceCard hidden={activeTab !== 'appearance'} />
          <DisplayCard hidden={activeTab !== 'appearance'} />
          <SectionsCard hidden={activeTab !== 'sections'} onRequestDelete={deletion.requestDelete} />
          <EditorCard hidden={activeTab !== 'editor'} />
          <DataCards hidden={activeTab !== 'data'} onOpenHistory={() => setHistoryOpen(true)} />
        </div>
      </div>

      <Presence>{historyOpen && <AutomaticHistory onClose={() => setHistoryOpen(false)} />}</Presence>
      <DeleteSectionDialog state={deletion.request} onCancel={deletion.cancel} onConfirm={deletion.confirmDelete} />
    </div>
  )
}
