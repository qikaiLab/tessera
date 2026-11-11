import ModalFrame from '../../components/ModalFrame'
import Presence from '../../components/Presence'

// Confirms deleting a section, or explains why it cannot be deleted: a section with data in any
// day is kept so history stays whole (it can be taken off the day page by un-pinning it).
// `state` is { isOpen, sec, hasData, unreadable, checking }: `unreadable` lists the days that could not
// be read, which also keeps the section, because nothing can be said about what those days hold.
const SHOWN_DATES = 3

export default function DeleteSectionDialog({ state, onCancel, onConfirm }) {
  const blocked = state.hasData || state.unreadable.length > 0
  return (
    <Presence>{state.isOpen && (
      <ModalFrame role="alertdialog" label="删除版块确认" onDismiss={onCancel} style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <span className="modal-title">删除版块确认</span>
            <button className="btn btn-ghost btn-icon" aria-label="关闭" onClick={onCancel}>✕</button>
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
            ) : state.unreadable.length > 0 ? (
              <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <p style={{ color: 'var(--error)', fontWeight: 'bold', marginBottom: 8 }}>暂时无法删除此版块</p>
                <p>
                  有 {state.unreadable.length} 天的记录当前无法读取（{state.unreadable.slice(0, SHOWN_DATES).join('、')}
                  {state.unreadable.length > SHOWN_DATES ? ' 等' : ''}），无法确认 <b>{state.sec?.name}</b> 在那些天里有没有数据。
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>
                  为了保证历史数据的完整性，暂不删除。如果只是暂时读不到（文件被占用、同步中），稍后再点一次删除即可；
                  文件确实损坏时，可在「记录」页打开那一天，或到「设置 → 数据与备份 → 查看自动历史」找回。
                  如果只是不想在今日记录中看到它，也可以先将其 <b>「取消常驻」</b>。
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
            <button className="btn btn-ghost" data-autofocus="" onClick={onCancel}>
              {blocked ? '知道了' : '取消'}
            </button>
            {!state.checking && !blocked && (
              <button className="btn btn-primary" style={{ background: 'var(--error)' }} onClick={onConfirm}>
                确定删除
              </button>
            )}
          </div>
      </ModalFrame>
    )}</Presence>
  )
}
