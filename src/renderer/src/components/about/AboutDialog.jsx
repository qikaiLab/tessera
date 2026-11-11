import { useCallback, useState } from 'react'
import { useApp } from '../../context/AppContext'
import BrandMark from '../BrandMark'
import ModalFrame from '../ModalFrame'
import authorAvatar from '../../assets/about/author-avatar.jpg'
import AboutIcon from './AboutIcon'
import {
  ABOUT_INFO,
  ABOUT_LINKS,
  THIRD_PARTY,
  buildVersionReport,
  readRuntimeVersions
} from './aboutInfo'
import './AboutDialog.css'

const TABS = [
  { id: 'author', label: '作者与链接' },
  { id: 'license', label: '许可与致谢' }
]

function openLink(url) {
  window.api?.shell?.openExternal?.(url)
}

// The "关于" dialog the ⓘ button in the sidebar footer opens. The app and its version stay on top;
// the author and the links, and the licence and thanks, each get a tab so nothing crowds the page.
export default function AboutDialog({ onClose }) {
  const { showToast } = useApp()
  const [tab, setTab] = useState('author')
  const runtime = readRuntimeVersions()
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform

  const copy = useCallback(async (text, doneMessage) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(doneMessage, 'success')
    } catch {
      showToast('复制失败，请手动选择文字复制', 'error')
    }
  }, [showToast])

  const versionReport = buildVersionReport({ version: __APP_VERSION__, runtime, platform })

  // Left and right move between the tabs, as they do in any tab strip.
  const onTabKeyDown = event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = TABS[(TABS.findIndex(item => item.id === tab) + step + TABS.length) % TABS.length]
    setTab(next.id)
    document.getElementById(`about-tab-${next.id}`)?.focus()
  }

  return (
    <ModalFrame onDismiss={onClose} label={`关于 ${ABOUT_INFO.appName}`} className="modal about-modal">
      <div className="about-head">
        <span className="about-logo"><BrandMark size={22} /></span>
        <div className="about-head-text">
          <h2 className="about-name">{ABOUT_INFO.appName}</h2>
          <p className="about-tagline">{ABOUT_INFO.tagline}</p>
        </div>
        <button className="btn btn-ghost btn-icon" aria-label="关闭" title="关闭 (Esc)" data-autofocus="" onClick={onClose}>✕</button>
      </div>

      <div className="about-version-row">
        <span
          className="about-version"
          title={[runtime.electron && `Electron ${runtime.electron}`, runtime.chromium && `Chromium ${runtime.chromium}`].filter(Boolean).join(' · ') || undefined}
        >
          v{__APP_VERSION__}
        </span>
        <button className="about-text-btn" onClick={() => copy(versionReport, '版本信息已复制')}>
          <AboutIcon name="copy" size={14} />
          复制版本信息
        </button>
      </div>

      <div className="about-tabs" role="tablist" aria-label="关于分类" onKeyDown={onTabKeyDown}>
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`about-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`about-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={`about-tab ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'author' && (
        <div className="about-panel" role="tabpanel" id="about-panel-author" aria-labelledby="about-tab-author">
          <div className="about-author">
            <img className="about-avatar" src={authorAvatar} alt="" width="48" height="48" draggable="false" />
            <div>
              <p className="about-author-name">{ABOUT_INFO.authorName}</p>
              <p className="about-author-role">{ABOUT_INFO.authorBio || '作者'}</p>
            </div>
          </div>

          <div className="about-tiles">
            {ABOUT_LINKS.map(link => (
              <button key={link.id} className="about-tile" onClick={() => openLink(link.url)} title={link.url}>
                <span className="about-tile-icon"><AboutIcon name={link.icon} /></span>
                {link.label}
              </button>
            ))}
          </div>

          <div className="about-contact">
            <div className="about-contact-row">
              <span className="about-contact-icon"><AboutIcon name="group" size={16} /></span>
              <span className="about-contact-value">QQ 群 {ABOUT_INFO.qqGroup}</span>
              <button className="about-copy-btn" aria-label="复制群号" title="复制群号" onClick={() => copy(ABOUT_INFO.qqGroup, '群号已复制')}>
                <AboutIcon name="copy" size={15} />
              </button>
            </div>
            {ABOUT_INFO.email && (
              <div className="about-contact-row">
                <span className="about-contact-value">{ABOUT_INFO.email}</span>
                <button className="about-copy-btn" aria-label="复制邮箱" title="复制邮箱" onClick={() => copy(ABOUT_INFO.email, '邮箱已复制')}>
                  <AboutIcon name="copy" size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'license' && (
        <div className="about-panel" role="tabpanel" id="about-panel-license" aria-labelledby="about-tab-license">
          <p className="about-text">
            {ABOUT_INFO.appName} 以 {ABOUT_INFO.license} 许可证发布：源码公开，个人学习、研究、爱好等非商业用途可自由使用、修改与分发；商业用途需另行取得作者许可。
            <button className="about-inline-link about-license-link" onClick={() => openLink(ABOUT_INFO.licenseUrl)} title={ABOUT_INFO.licenseUrl}>查看许可证全文 ↗</button>
          </p>
          <p className="about-text">软件使用了以下开源组件，感谢它们的作者：</p>
          <ul className="about-third-party">
            {THIRD_PARTY.map(item => (
              <li key={item.name}>
                <button className="about-inline-link" onClick={() => openLink(item.url)} title={item.url}>{item.name}</button>
                <span className="about-license">{item.license}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalFrame>
  )
}
