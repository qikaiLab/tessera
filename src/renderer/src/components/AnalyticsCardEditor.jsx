import React, { useMemo } from 'react'
import SelectMenu from './SelectMenu'
import {
  CHART_TYPES,
  DATE_AXIS_MODES,
  DATE_RANGES,
  LINE_STYLE_MODES,
  getDateAxisMode,
  getLineStyle,
  getMetricLabel,
  moveBindingToFront,
  setBoundSections
} from '../utils/analyticsCard'
import './AnalyticsCardEditor.css'

function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div className="segmented-control" role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={`segmented-btn ${value === option.id ? 'active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.icon && <span aria-hidden="true">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="card-editor-row">
      <span className="card-editor-label">{label}</span>
      <div className="card-editor-control">{children}</div>
    </div>
  )
}

export default function AnalyticsCardEditor({ card, sections, onUpdate }) {
  const bindings = useMemo(() => card.bindings || [], [card.bindings])
  const isHeatmap = card.type === 'heatmap'
  const supportsDateAxisMode = card.type === 'line' || card.type === 'bar'

  const sectionOptions = useMemo(
    () => sections.map(section => ({
      value: section.id,
      label: section.name,
      color: section.color,
      hint: getMetricLabel(section.type === 'text' ? 'wordcount' : 'value')
    })),
    [sections]
  )

  const boundIds = useMemo(() => bindings.map(binding => binding.sectionId), [bindings])

  const removeBinding = (sectionId) => {
    onUpdate({ bindings: bindings.filter(binding => binding.sectionId !== sectionId) })
  }

  return (
    <div className="card-editor">
      {/* Switching type only changes `type`: every other choice stays on the card. */}
      <Row label="图表类型">
        <SegmentedControl
          ariaLabel="图表类型"
          options={CHART_TYPES}
          value={card.type}
          onChange={type => onUpdate({ type })}
        />
      </Row>

      <Row label="数据">
        <div className="card-editor-series">
          {bindings.map((binding, index) => {
            const section = sections.find(item => item.id === binding.sectionId)
            const unused = isHeatmap && index > 0
            return (
              <span
                key={binding.sectionId}
                className={`series-chip ${unused ? 'is-unused' : ''} ${section ? '' : 'is-missing'}`}
              >
                <button
                  type="button"
                  className="series-chip-main"
                  disabled={!unused}
                  onClick={() => onUpdate({ bindings: moveBindingToFront(bindings, binding.sectionId) })}
                  title={unused ? '设为热力图使用的数据' : undefined}
                >
                  <span className="series-chip-dot" style={{ background: section?.color || 'var(--accent)' }} />
                  <span className="series-chip-name">{section ? section.name : '（版块已删除）'}</span>
                  <span className="series-chip-metric">{getMetricLabel(binding.metric)}</span>
                </button>
                <button
                  type="button"
                  className="series-chip-remove"
                  onClick={() => removeBinding(binding.sectionId)}
                  aria-label={`移除${section ? section.name : '已删除的版块'}`}
                >
                  ✕
                </button>
              </span>
            )
          })}
          <SelectMenu
            multiple
            ariaLabel="选择要展示的数据"
            options={sectionOptions}
            value={boundIds}
            onChange={ids => onUpdate({ bindings: setBoundSections(bindings, ids, sections) })}
            emptyText="还没有可用的数据版块"
            trigger={({ ref, props, open }) => (
              <button
                ref={ref}
                {...props}
                className={`series-add-btn ${open ? 'is-open' : ''}`}
              >
                ＋ {bindings.length ? '添加或调整' : '选择数据'}
              </button>
            )}
          />
        </div>
        {isHeatmap && bindings.length > 1 && (
          <p className="card-editor-hint">热力图只绘制第一项数据；点击灰色的数据项可将其设为热力图数据，其余选择会保留。</p>
        )}
      </Row>

      <Row label="时间范围">
        <SegmentedControl
          ariaLabel="时间范围"
          options={DATE_RANGES}
          value={card.dateRange}
          onChange={dateRange => onUpdate({ dateRange })}
        />
      </Row>

      {supportsDateAxisMode && (
        <Row label="横坐标">
          <SegmentedControl
            ariaLabel="日期横坐标"
            options={DATE_AXIS_MODES}
            value={getDateAxisMode(card)}
            onChange={dateAxisMode => onUpdate({ dateAxisMode })}
          />
        </Row>
      )}

      {card.type === 'line' && (
        <Row label="线条">
          <SegmentedControl
            ariaLabel="线条样式"
            options={LINE_STYLE_MODES}
            value={getLineStyle(card)}
            onChange={lineStyle => onUpdate({ lineStyle })}
          />
        </Row>
      )}
    </div>
  )
}
