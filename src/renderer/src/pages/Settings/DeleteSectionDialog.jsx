import Presence from '../../components/Presence'

// Confirms deleting a section, or explains why it cannot be deleted: a section with data in any
// day is kept so history stays whole (it can be taken off the day page by un-pinning it).
// `state` is { isOpen, sec, hasData, checking }.
export default function DeleteSectionDialog({ state, onCancel, onConfirm }) {
  return (
    <Presence>{state.isOpen && (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <span className="modal-title">删除版块确认</span>
            <button className="btn btn-ghost btn-icon" onClick={onCancel}>✕</button>
          </div>
          <div style={{ marginBottom: 20 }}>
            {state.checking ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>正在检查历史记录...</span>
              </div>
            ) : state.hasData ? (
              <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p style={{ color: 'var(--error)', fontWeight: 'bold', marginBottom: 8 }}>无法删除此版块！</p>
                <p>我们在您的历史记录中发现了属于 <b>{state.sec?.name}</b> 的数据。</p>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>
                  为了保证历史数据的完整性，包含已有记录的版块禁止被删除。如果您不想在今日记录中看到它，请将其 <b>「取消常驻」</b>。
                </p>
              </div>
            ) : (
              <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p>确定要删除版块 <b>{state.sec?.name}</b> 吗？</p>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>此版块没有关联的历史数据，可以安全删除。删除后无法恢复。</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onCancel}>
              {state.hasData ? '知道了' : '取消'}
            </button>
            {!state.checking && !state.hasData && (
              <button className="btn btn-primary" style={{ background: 'var(--error)' }} onClick={onConfirm}>
                确定删除
              </button>
            )}
          </div>
        </div>
      </div>
    )}</Presence>
  )
}
