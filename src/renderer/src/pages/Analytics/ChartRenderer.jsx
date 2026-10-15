import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { LINE_STYLE_STRAIGHT, getLineStyle } from '../../utils/analyticsCard'
import { formatAxisDate, isNormalizedChart } from '../../utils/analyticsData'
import Heatmap from './Heatmap'
import { AXIS_TICK, CHART_MOTION, TOOLTIP_PROPS, normalizedTooltipFormatter } from './chartTheme'

const CHART_HEIGHT = 220

// How many Y axes a chart gets: one for a single series, a left and a right one for two, none
// (just the legend) for more, and a 0-100 % one when the series are normalized.
function getYAxisMode(card, seriesCount) {
  if (isNormalizedChart(card, seriesCount)) return 'normalized'
  if (seriesCount <= 1) return 'single'
  return seriesCount === 2 ? 'dual' : 'none'
}

function yAxisIdFor(yMode, index) {
  if (yMode === 'dual') return index === 0 ? 'left' : 'right'
  return yMode === 'single' || yMode === 'normalized' ? 'left' : undefined
}

// Recharts finds its axes among the chart's direct children, so this returns the elements
// instead of being a component of its own (a wrapper component would hide them).
function renderYAxes({ yMode, names, sections, palette }) {
  const colorOf = (index) => sections.find(s => s.name === names[index])?.color || palette[index]
  if (yMode === 'single') return <YAxis yAxisId="left" tick={AXIS_TICK} width={40} />
  if (yMode === 'normalized') {
    return (
      <YAxis
        yAxisId="left"
        domain={[0, 100]}
        tickFormatter={value => `${value}%`}
        tick={AXIS_TICK}
        width={44}
      />
    )
  }
  if (yMode === 'dual') {
    return (
      <>
        <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: colorOf(0) }} width={40} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: colorOf(1) }} width={40} />
      </>
    )
  }
  return null
}

// Line and bar charts differ only in the series they draw.
function AxisChart({ card, data, names, sections, palette }) {
  const isLine = card.type === 'line'
  const Chart = isLine ? LineChart : BarChart
  const yMode = getYAxisMode(card, names.length)
  const tooltipProps = yMode === 'normalized'
    ? { ...TOOLTIP_PROPS, formatter: normalizedTooltipFormatter }
    : TOOLTIP_PROPS
  const lineType = getLineStyle(card) === LINE_STYLE_STRAIGHT ? 'linear' : 'monotone'

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <Chart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={AXIS_TICK}
          minTickGap={18}
          interval="preserveStartEnd"
        />
        {renderYAxes({ yMode, names, sections, palette })}
        <Tooltip {...tooltipProps} />
        {(yMode === 'dual' || yMode === 'none' || names.length > 1) && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {names.map((name, i) => {
          const color = sections.find(s => s.name === name)?.color || palette[i % palette.length]
          return isLine ? (
            <Line
              key={name}
              type={lineType}
              dataKey={name}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              {...CHART_MOTION}
              yAxisId={yAxisIdFor(yMode, i)}
            />
          ) : (
            <Bar
              key={name}
              dataKey={name}
              fill={color}
              radius={[3, 3, 0, 0]}
              {...CHART_MOTION}
              yAxisId={yAxisIdFor(yMode, i)}
            />
          )
        })}
      </Chart>
    </ResponsiveContainer>
  )
}

function PieView({ data }) {
  return (
    <ResponsiveContainer className="analytics-pie-chart" width="100%" height={CHART_HEIGHT}>
      <PieChart margin={{ top: 20, right: 36, bottom: 20, left: 36 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={72}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
          {...CHART_MOTION}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_PROPS} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Draws the card's chart type from its prepared data (see buildChartData).
export default function ChartRenderer({ card, data, sections, heatmapColor, palette }) {
  // The bound sections' names, in the order the sections are listed.
  const names = sections
    .filter(section => (card.bindings || []).some(binding => binding.sectionId === section.id))
    .map(section => section.name)

  if (card.type === 'line' || card.type === 'bar') {
    return <AxisChart card={card} data={data} names={names} sections={sections} palette={palette} />
  }
  if (card.type === 'pie') return <PieView data={data} />
  if (card.type === 'heatmap') return <Heatmap data={data} color={heatmapColor} dateRange={card.dateRange} />
  return null
}
