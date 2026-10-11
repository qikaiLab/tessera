import React from 'react'
import Popover from './Popover'
import { getPresetRange, RANGE_PRESETS, formatRangeLabel } from '../utils/timelineRange'
import './FilterChip.css'
import './DateRangeMenu.css'

/**
 * Compact date-range picker: one button that shows the active range, and a panel with
 * quick presets plus exact start/end dates.
 */
export default function DateRangeMenu({ from, to, onChange }) {
  const active = Boolean(from || to)

  return (
    <Popover
      label="时间范围"
      trigger={({ ref, props, open }) => (
        <button
          ref={ref}
          {...props}
          className={`filter-chip ${active ? 'is-active' : ''} ${open ? 'is-open' : ''}`}
          aria-label={`时间范围：${formatRangeLabel(from, to)}`}
        >
          <span className="filter-chip-icon" aria-hidden="true">📅</span>
          <span className="filter-chip-text">{formatRangeLabel(from, to)}</span>
          <span className="filter-chip-chevron" aria-hidden="true">▾</span>
        </button>
      )}
    >
      {({ close }) => (
        <div className="date-range-panel">
          <div className="date-range-presets">
            {RANGE_PRESETS.map(preset => (
              <button
                key={preset.value}
                type="button"
                className="date-range-preset"
                onClick={() => {
                  const range = getPresetRange(preset.value)
                  onChange(range.from, range.to)
                  close()
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="date-range-fields">
            <label className="date-range-field">
              <span>开始</span>
              <input type="date" className="input" value={from} max={to || undefined} onChange={event => onChange(event.target.value, to)} />
            </label>
            <label className="date-range-field">
              <span>结束</span>
              <input type="date" className="input" value={to} min={from || undefined} onChange={event => onChange(from, event.target.value)} />
            </label>
          </div>
        </div>
      )}
    </Popover>
  )
}
