import { useState } from 'react'
import ModalFrame from '../../components/ModalFrame'
import { describeCountdown } from '../../utils/countdowns'

const COLORS = ['#7c6aff', '#34d399', '#f87171', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa']

// Manage the countdown days (name, date, colour). Changes are only applied on "保存".
export default function CountdownModal({ countdowns, onSave, onClose, confirm }) {
  const [list, setList] = useState(countdowns)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [addError, setAddError] = useState('')

  const newItem = () => ({ id: Date.now(), name: newName, date: newDate, color: newColor })

  const add = () => {
    if (!newName && !newDate) {
      setAddError('请填写名称和日期')
      return
    }
    if (!newName) {
      setAddError('请填写倒数日名称')
      return
    }
    if (!newDate) {
      setAddError('请选择目标日期')
      return
    }
    setAddError('')
    setList(prev => [...prev, newItem()])
    setNewName('')
    setNewDate('')
  }

  const remove = (id) => setList(prev => prev.filter(c => c.id !== id))

  // Saving with a half-filled "add" form asks what to do with it first.
  const handleSave = async () => {
    if (!newName && !newDate) {
      onSave(list)
      onClose()
      return
    }

    const message = newName && newDate
      ? `您填写了「${newName}」但还未点击「添加」，是否先将其添加再保存？`
      : '您有未完成的倒数日信息还未添加，是否直接保存（填写内容将被丢弃）？'
    const addFirst = await confirm({
      message,
      title: '保存确认',
      confirmText: '添加并保存',
      cancelText: '直接保存',
      // Closing the question (✕, Esc, a click outside) means "not yet", not "save without it".
      dismissValue: null
    })
    if (addFirst === null) return
    if (!addFirst) {
      onSave(list)
    } else if (newName && newDate) {
      onSave([...list, newItem()])
    } else {
      // Only one of the two fields is filled: ask for the other one.
      setAddError(!newName ? '请填写倒数日名称' : '请选择目标日期')
      return
    }
    onClose()
  }

  return (
    <ModalFrame label="倒数日管理" onDismiss={onClose}>
        <div className="modal-header">
          <span className="modal-title">倒数日管理</span>
          <button className="btn btn-ghost btn-icon" aria-label="关闭" onClick={onClose}>✕</button>
        </div>
        <div className="countdown-list" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {list.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              还没有倒数日，在下方添加第一个吧 ↓
            </p>
          )}
          {list.map(cd => (
            <div key={cd.id} className="countdown-row">
              <span className="countdown-dot" style={{ background: cd.color }} />
              <span className="cd-name">{cd.name}</span>
              <span className="cd-date">{cd.date}</span>
              <span className="cd-diff">{describeCountdown(cd.date)}</span>
              <button className="btn btn-ghost btn-icon" aria-label={`删除倒数日 ${cd.name}`} onClick={() => remove(cd.id)}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface-2)', borderRadius: 10, padding: '12px', marginBottom: 12, border: addError ? '1px solid var(--error)' : '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            添加新倒数日
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: addError ? 8 : 0 }}>
            <input
              className="input"
              placeholder="名称（必填）"
              data-autofocus=""
              style={{ flex: 1, minWidth: 100, borderColor: addError && !newName ? 'var(--error)' : undefined }}
              value={newName}
              onChange={e => { setNewName(e.target.value); setAddError('') }}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <input
              type="date"
              className="input"
              style={{ flex: 1, minWidth: 130, borderColor: addError && !newDate ? 'var(--error)' : undefined }}
              value={newDate}
              onChange={e => { setNewDate(e.target.value); setAddError('') }}
            />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  aria-label={`颜色 ${c}`}
                  aria-pressed={newColor === c}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: c,
                    border: newColor === c ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer', boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={add}>添加</button>
          </div>
          {addError && (
            <div style={{ fontSize: 12, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⚠</span> {addError}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave}>保存</button>
        </div>
    </ModalFrame>
  )
}
