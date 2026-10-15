import { formatTooltipDate } from '../../utils/analyticsData'

export const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--chart-tooltip-background)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--chart-tooltip-shadow)',
    fontSize: '12px',
    color: 'var(--chart-tooltip-text)'
  },
  itemStyle: { color: 'var(--chart-tooltip-text)' },
  labelStyle: { color: 'var(--chart-tooltip-label)' },
  labelFormatter: formatTooltipDate
}

// Recharts draws in over 1.5 s by default, which feels sluggish next to the rest of the UI.
export const CHART_MOTION = { isAnimationActive: true, animationDuration: 550, animationEasing: 'ease-out' }

export const AXIS_TICK = { fontSize: 11, fill: 'var(--text-muted)' }

// Normalized series are plotted as percentages; the tooltip still reports the real number.
export function normalizedTooltipFormatter(value, name, item) {
  const raw = item?.payload?.__raw?.[name]
  return raw === undefined ? [value, name] : [`${raw}（${value}%）`, name]
}

export const SECONDARY_PALETTE = ['#34d399', '#f87171', '#fbbf24', '#60a5fa', '#f472b6']

// The accent colour as drawn right now, for the first series (charts need a hex value, not a var()).
export function getRenderedAccentColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#7c6aff'
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}
