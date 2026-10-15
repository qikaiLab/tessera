import { formatDateLinkLabel, normalizeDateLink } from '../../utils/notes'
import './DateLinkPanel.css'

// The button in a note's meta line that shows its linked day(s), and the panel that edits them.
// `link` is the form from useNoteDateLink.
export default function DateLinkPanel({ note, link }) {
  const { draft, setDraft } = link
  return (
    <div className="notes-date-link-wrap">
      <button
        className={`notes-date-link-btn ${normalizeDateLink(note.dateLink) ? 'linked' : ''}`}
        onClick={link.togglePanel}
      >
        {formatDateLinkLabel(note.dateLink) || '未关联日期'}
      </button>
      {link.panelOpen && (
        <div className="notes-date-link-panel">
          <div className="notes-date-link-panel-title">关联日期</div>
          <div className="notes-date-link-type">
            <button
              className={draft.type === 'none' ? 'active' : ''}
              onClick={() => setDraft(prev => ({ ...prev, type: 'none' }))}
            >
              无
            </button>
            <button
              className={draft.type === 'single' ? 'active' : ''}
              onClick={() => setDraft(prev => ({ ...prev, type: 'single', end: prev.start }))}
            >
              单日
            </button>
            <button
              className={draft.type === 'range' ? 'active' : ''}
              onClick={() => setDraft(prev => ({ ...prev, type: 'range', end: prev.end || prev.start }))}
            >
              时间段
            </button>
          </div>
          {draft.type !== 'none' && (
            <div className="notes-date-link-fields">
              <label>
                <span>{draft.type === 'single' ? '日期' : '开始'}</span>
                <input
                  className="input"
                  type="date"
                  value={draft.start}
                  onChange={e => setDraft(prev => ({
                    ...prev,
                    start: e.target.value,
                    end: prev.type === 'single' ? e.target.value : prev.end
                  }))}
                />
              </label>
              {draft.type === 'range' && (
                <label>
                  <span>结束</span>
                  <input
                    className="input"
                    type="date"
                    value={draft.end}
                    onChange={e => setDraft(prev => ({ ...prev, end: e.target.value }))}
                  />
                </label>
              )}
            </div>
          )}
          <div className="notes-date-link-actions">
            <button className="btn btn-ghost btn-sm" onClick={link.clear}>清除</button>
            <button className="btn btn-primary btn-sm" onClick={link.save}>保存</button>
          </div>
        </div>
      )}
    </div>
  )
}
