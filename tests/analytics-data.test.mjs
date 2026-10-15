import { describe, expect, it } from 'vitest'
import {
  buildChartData,
  formatAxisDate,
  formatTooltipDate,
  getDateRange,
  getHeatmapColor,
  hasChartBindingData,
  isNormalizedChart,
  resolveBindingValue
} from '../src/renderer/src/utils/analyticsData.js'

const today = new Date(2026, 9, 13) // 2026-10-13
const palette = ['#111111', '#222222', '#333333']

const doc = (text) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

const sections = [
  { id: 'steps', name: '步数', type: 'number', resident: false, color: '#ff0000' },
  { id: 'sleep', name: '睡眠', type: 'number', resident: false, numberDefaultMode: 'carry' },
  { id: 'diary', name: '日记', type: 'text', resident: true }
]

const loadedData = {
  '2026-10-10': { steps: { value: '4000' }, sleep: { value: '7' }, diary: { value: doc('今天 很好') } },
  '2026-10-12': { steps: { value: '6000' }, diary: { value: doc('abc') } },
  '2026-10-13': { steps: { value: '8000' } }
}
const datesWithData = Object.keys(loadedData)

const card = (overrides) => ({
  type: 'line', bindings: [], dateRange: '7', dateAxisMode: 'recorded', ...overrides
})
const steps = { sectionId: 'steps', metric: 'value' }
const sleep = { sectionId: 'sleep', metric: 'value' }
const diaryWords = { sectionId: 'diary', metric: 'wordcount' }

describe('which days a chart covers', () => {
  it('uses the recorded days inside the range', () => {
    expect(getDateRange(card({ dateRange: '7' }), datesWithData, [], loadedData, today)).toEqual(datesWithData)
    expect(getDateRange(card({ dateRange: '2' }), datesWithData, [], loadedData, today)).toEqual(['2026-10-12', '2026-10-13'])
    expect(getDateRange(card({ dateRange: 'custom', dateFrom: '2026-10-11', dateTo: '2026-10-12' }), datesWithData, [], loadedData, today))
      .toEqual(['2026-10-12'])
    expect(getDateRange(card({ dateRange: 'all' }), datesWithData, [], loadedData, today)).toEqual(datesWithData)
  })

  it('lists every calendar day on a continuous axis', () => {
    const continuous = card({ dateRange: '4', dateAxisMode: 'continuous' })
    expect(getDateRange(continuous, datesWithData, [steps], loadedData, today))
      .toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'])
    const all = card({ dateRange: 'all', dateAxisMode: 'continuous' })
    expect(getDateRange(all, datesWithData, [steps], loadedData, today)).toEqual([
      '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'
    ])
    const custom = card({ dateRange: 'custom', dateFrom: '2026-10-05', dateTo: '2026-10-03', dateAxisMode: 'continuous' })
    expect(getDateRange(custom, datesWithData, [steps], loadedData, today)).toEqual([])
  })

  it('does not reorder the days it is given', () => {
    const unsorted = ['2026-10-13', '2026-10-10']
    buildChartData(card({ dateRange: 'all', bindings: [steps] }), sections, loadedData, unsorted, palette, today)
    expect(unsorted).toEqual(['2026-10-13', '2026-10-10'])
  })
})

describe('values', () => {
  it('knows when a day has something to draw', () => {
    expect(hasChartBindingData('2026-10-10', [steps], loadedData)).toBe(true)
    expect(hasChartBindingData('2026-10-11', [steps], loadedData)).toBe(false)
    // A text section with only spaces has no words.
    expect(hasChartBindingData('x', [diaryWords], { x: { diary: { value: doc('   ') } } })).toBe(false)
    expect(hasChartBindingData('2026-10-12', [diaryWords], loadedData)).toBe(true)
  })

  it('counts characters without spaces for text sections', () => {
    expect(resolveBindingValue('2026-10-10', diaryWords, sections[2], loadedData)).toBe(4)
  })

  it('carries the last number over for sections set to do so, and 0 for the others', () => {
    expect(resolveBindingValue('2026-10-13', sleep, sections[1], loadedData)).toBe(7)
    expect(resolveBindingValue('2026-10-09', sleep, sections[1], loadedData)).toBe(0)
    expect(resolveBindingValue('2026-10-11', steps, sections[0], loadedData)).toBe(0)
  })
})

describe('chart data', () => {
  it('draws one point per recorded day for a line chart', () => {
    const data = buildChartData(card({ bindings: [steps] }), sections, loadedData, datesWithData, palette, today)
    expect(data).toEqual([
      { date: '2026-10-10', 步数: 4000 },
      { date: '2026-10-12', 步数: 6000 },
      { date: '2026-10-13', 步数: 8000 }
    ])
  })

  it('keeps quiet days on a continuous axis', () => {
    const data = buildChartData(card({ dateRange: '4', dateAxisMode: 'continuous', bindings: [steps] }), sections, loadedData, datesWithData, palette, today)
    expect(data.map(point => point.步数)).toEqual([4000, 0, 6000, 8000])
  })

  it('draws only the days where a bound section has data on a recorded axis', () => {
    const data = buildChartData(card({ bindings: [sleep] }), sections, loadedData, datesWithData, palette, today)
    expect(data.map(point => point.date)).toEqual(['2026-10-10'])
  })

  it('normalizes several series to a percentage of their own peak', () => {
    const data = buildChartData(card({ type: 'bar', axisMode: 'normalized', bindings: [steps, diaryWords] }), sections, loadedData, datesWithData, palette, today)
    expect(isNormalizedChart(card({ type: 'bar', axisMode: 'normalized' }), 2)).toBe(true)
    expect(isNormalizedChart(card({ type: 'bar', axisMode: 'normalized' }), 1)).toBe(false)
    expect(isNormalizedChart(card({ type: 'pie', axisMode: 'normalized' }), 2)).toBe(false)
    expect(data[2].步数).toBe(100)
    expect(data[2].__raw.步数).toBe(8000)
  })

  it('totals each bound section into a pie slice, coloured by the section or the palette', () => {
    const data = buildChartData(card({ type: 'pie', bindings: [steps, sleep, { sectionId: 'gone', metric: 'value' }] }), sections, loadedData, datesWithData, palette, today)
    expect(data).toEqual([
      { name: '步数', value: 18000, fill: '#ff0000' },
      { name: '睡眠', value: 7, fill: '#222222' }
    ])
  })

  it('gives a heatmap every day of its weeks, quiet days as 0', () => {
    const data = buildChartData(card({ type: 'heatmap', dateRange: '7', bindings: [steps] }), sections, loadedData, datesWithData, palette, today)
    expect(data.at(-1)).toEqual({ date: '2026-10-13', value: 8000 })
    expect(data.find(day => day.date === '2026-10-11').value).toBe(0)
    expect(buildChartData(card({ type: 'heatmap', bindings: [] }), sections, loadedData, datesWithData, palette, today).every(day => day.value === 0)).toBe(true)
  })

  it('picks the heatmap colour from the section, then the palette', () => {
    expect(getHeatmapColor(card({ type: 'heatmap', bindings: [steps] }), sections, palette)).toBe('#ff0000')
    expect(getHeatmapColor(card({ type: 'heatmap', bindings: [sleep] }), sections, palette)).toBe('#222222')
    expect(getHeatmapColor(card({ type: 'line', bindings: [steps] }), sections, palette)).toBe('#111111')
  })
})

describe('date labels', () => {
  it('formats axis and tooltip dates and passes unparseable values through', () => {
    expect(formatAxisDate('2026-10-13')).toBe('10/13')
    expect(formatTooltipDate('2026-10-13')).toBe('2026-10-13')
    expect(formatAxisDate('not a date')).toBe('not a date')
  })
})
