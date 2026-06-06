import React, { useEffect, useRef, useState } from 'react'
import './SaveStatusBadge.css'

const SAVE_IDLE = 'idle'
const SAVE_SAVING = 'saving'

const STATUS_META = {
  saved: { text: '已保存', cls: 'status-saved', dot: 'saved' },
  unsaved: { text: '未保存', cls: 'status-unsaved', dot: 'unsaved' },
  saving: { text: '保存中...', cls: 'status-saving', dot: 'saving' },
  failed: { text: '保存失败', cls: 'status-failed', dot: 'failed' },
}

export default function SaveStatusBadge({ status, compact = false }) {
  const [visible, setVisible] = useState(status !== SAVE_IDLE)
  const [displayStatus, setDisplayStatus] = useState(status === SAVE_IDLE ? 'saved' : status)
  const savingTimerRef = useRef(null)

  useEffect(() => {
    if (savingTimerRef.current) {
      clearTimeout(savingTimerRef.current)
      savingTimerRef.current = null
    }

    if (status === SAVE_IDLE) {
      setVisible(false)
      return undefined
    }

    if (status === SAVE_SAVING) {
      savingTimerRef.current = setTimeout(() => {
        setDisplayStatus(status)
        setVisible(true)
        savingTimerRef.current = null
      }, 220)
      return () => {
        if (savingTimerRef.current) clearTimeout(savingTimerRef.current)
      }
    }

    setDisplayStatus(status)
    setVisible(true)
    return undefined
  }, [status])

  const meta = STATUS_META[displayStatus] || STATUS_META.saved

  return (
    <span
      className={`save-status-badge ${meta.cls} ${compact ? 'compact' : ''} ${visible ? 'is-visible' : 'is-hidden'}`}
      aria-hidden={!visible}
    >
      <span className={`save-status-dot ${meta.dot}`} />
      <span className="save-status-text">{meta.text}</span>
    </span>
  )
}
