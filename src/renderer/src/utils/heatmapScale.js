// Maps heatmap values to a 0..1 intensity.
//
// A plain value / max scale lets one extreme day (3800 next to 30, 80, 150 ...) flatten every
// other day into the same faint shade. Rank blends in how a day compares with the others, so
// ordinary days stay distinguishable, while a log term keeps the extreme day the brightest.
const RANK_WEIGHT = 0.7

export function createHeatmapScale(values) {
  const positives = values.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b)
  if (positives.length === 0) return () => 0

  const max = positives[positives.length - 1]
  if (positives[0] === max) return value => (value > 0 ? 1 : 0)

  const logMax = Math.log1p(max)
  const total = positives.length

  // Midrank of every distinct value, so equal values share one shade.
  const ranks = new Map()
  let index = 0
  while (index < total) {
    let end = index
    while (end + 1 < total && positives[end + 1] === positives[index]) end += 1
    ranks.set(positives[index], (index + end + 1) / 2 / total)
    index = end + 1
  }

  return value => {
    if (!Number.isFinite(value) || value <= 0) return 0
    const rank = ranks.get(value) ?? positives.filter(candidate => candidate < value).length / total
    const magnitude = Math.log1p(value) / logMax
    return Math.min(1, RANK_WEIGHT * rank + (1 - RANK_WEIGHT) * magnitude)
  }
}

export const HEATMAP_EMPTY_COLOR = 'rgba(128,128,128,0.15)'
const MIN_ALPHA = 0.2

export function getHeatmapAlpha(intensity) {
  return MIN_ALPHA + (1 - MIN_ALPHA) * intensity
}
