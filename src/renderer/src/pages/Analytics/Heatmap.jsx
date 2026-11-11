import { useEffect, useMemo, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { HEATMAP_EMPTY_COLOR, createHeatmapScale, getHeatmapAlpha } from '../../utils/heatmapScale'
import { hexToRgba } from './chartTheme'
import './Heatmap.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function HeatmapLegend({ color, maxValue }) {
  return (
    <div className="heatmap-legend" aria-hidden="true">
      <span>少</span>
      {[0, 0.25, 0.5, 0.75, 1].map(step => (
        <span
          key={step}
          className="heatmap-legend-swatch"
          style={{ background: step === 0 ? HEATMAP_EMPTY_COLOR : hexToRgba(color, getHeatmapAlpha(step)) }}
        />
      ))}
      <span>多</span>
      {maxValue > 0 && <span className="heatmap-legend-max">最高 {Number(maxValue.toFixed(2))}</span>}
    </div>
  )
}

// A day-by-day colour grid: one row of seven for a week, weeks as columns otherwise.
export default function Heatmap({ data, color, dateRange }) {
  const scrollRef = useRef(null)
  const scale = useMemo(() => createHeatmapScale(data.map(d => d.value)), [data])
  const maxValue = useMemo(() => data.reduce((max, d) => Math.max(max, d.value), 0), [data])

  // Show the most recent days first: scroll to the right edge. Only when the grid itself changes
  // (another range, another number of days), not on every new data array: editing the card's title
  // makes one, and must not throw away where the user had scrolled to.
  const dayCount = data.length
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [dayCount, dateRange])

  // The wheel scrolls the grid sideways when it overflows. React's onWheel is passive and cannot
  // call preventDefault() reliably, so this needs a native, non-passive listener.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return
      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault()
        e.stopPropagation()
        el.scrollLeft += e.deltaY * 1.5
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [dayCount, dateRange])

  if (!data.length) return null

  const getColor = (value) => {
    const intensity = scale(value)
    return intensity === 0 ? HEATMAP_EMPTY_COLOR : hexToRgba(color, getHeatmapAlpha(intensity))
  }

  if (dateRange === '7') {
    return (
      <div className="heatmap-block">
        <div className="heatmap-7d">
          {data.map((day, i) => {
            const date = parseISO(day.date)
            return (
              <div key={i} className="heatmap-7d-col">
                <div className="heatmap-7d-label">{format(date, 'MM/dd')}</div>
                <div className="heatmap-cell" style={{ background: getColor(day.value) }} title={`${day.date}: ${day.value}`} />
                <div className="heatmap-7d-weekday">{WEEKDAYS[date.getDay()]}</div>
              </div>
            )
          })}
        </div>
        <HeatmapLegend color={color} maxValue={maxValue} />
      </div>
    )
  }

  // 30 and 90 days fit without scrolling: compact and centred.
  const isCompact = dateRange === '30' || dateRange === '90'

  return (
    <div className="heatmap-block">
      <div className={`heatmap-wrapper${isCompact ? ' heatmap-compact' : ''}`} ref={scrollRef}>
        <div className={`heatmap${isCompact ? ' heatmap-compact-grid' : ''}`}>
          {data.map((day, i) => (
            day.padded
              // Only completes the first week of the grid: a blank space, not a day of the range.
              ? <div key={i} className="heatmap-cell" style={{ visibility: 'hidden' }} aria-hidden="true" />
              : <div key={i} className="heatmap-cell" style={{ background: getColor(day.value) }} title={`${day.date}: ${day.value}`} />
          ))}
        </div>
      </div>
      <HeatmapLegend color={color} maxValue={maxValue} />
    </div>
  )
}
