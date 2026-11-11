import { useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import ModalFrame from '../ModalFrame'
import {
  ABOUT_INFO,
  ABOUT_LINKS,
  THIRD_PARTY,
  buildVersionReport,
  readRuntimeVersions
} from './aboutInfo'
import './AboutDialog.css'

function openLink(url) {
  window.api?.shell?.openExternal?.(url)
}

// The "关于" dialog the ⓘ button in the sidebar footer opens: version, author, links, licence.
export default function AboutDialog({ onClose }) {
  const { showToast } = useApp()
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

  return (
    <ModalFrame onDismiss={onClose} label={`关于 ${ABOUT_INFO.appName}`} className="modal about-modal">
      <div className="about-head">
        <div>
          <h2 className="about-name">{ABOUT_INFO.appName}</h2>
          <p className="about-tagline">{ABOUT_INFO.tagline}</p>
        </div>
        <button className="btn btn-ghost btn-icon" aria-label="关闭" title="关闭 (Esc)" data-autofocus="" onClick={onClose}>✕</button>
      </div>

      <section className="about-section">
        <h3 className="about-heading">版本</h3>
        <div className="about-version-row">
          <span className="about-version">v{__APP_VERSION__}</span>
          <span className="about-runtime">
            {[runtime.electron && `Electron ${runtime.electron}`, runtime.chromium && `Chromium ${runtime.chromium}`, platform]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <button className="btn btn-secondary about-small-btn" onClick={() => copy(versionReport, '版本信息已复制')}>复制版本信息</button>
        </div>
      </section>

      <section className="about-section">
        <h3 className="about-heading">作者</h3>
        {ABOUT_INFO.authorName && <p className="about-author">{ABOUT_INFO.authorName}</p>}
        {ABOUT_INFO.authorBio && <p className="about-text">{ABOUT_INFO.authorBio}</p>}
        <div className="about-links">
          {ABOUT_LINKS.map(link => (
            <button key={link.id} className="about-link" onClick={() => openLink(link.url)} title={link.url}>
              {link.label}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className="about-contact">
          <div className="about-contact-row">
            <span className="about-contact-label">交流群</span>
            <span className="about-contact-value">QQ {ABOUT_INFO.qqGroup}</span>
            <button className="btn btn-secondary about-small-btn" onClick={() => copy(ABOUT_INFO.qqGroup, '群号已复制')}>复制群号</button>
          </div>
          {ABOUT_INFO.email && (
            <div className="about-contact-row">
              <span className="about-contact-label">邮箱</span>
              <span className="about-contact-value">{ABOUT_INFO.email}</span>
              <button className="btn btn-secondary about-small-btn" onClick={() => copy(ABOUT_INFO.email, '邮箱已复制')}>复制邮箱</button>
            </div>
          )}
        </div>
      </section>

      <section className="about-section">
        <h3 className="about-heading">许可与致谢</h3>
        <p className="about-text">
          {ABOUT_INFO.appName} 以 {ABOUT_INFO.license} 许可证开源，可自由使用、修改与分发，完整条款见仓库中的 LICENSE 文件。
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
      </section>
    </ModalFrame>
  )
}
