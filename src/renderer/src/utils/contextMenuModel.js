import { clamp } from './math'

export function normalizeContextMenuItems(items = []) {
  const visibleItems = items.filter(item => item && item.visible !== false)
  const normalized = []

  visibleItems.forEach(item => {
    if (item.type === 'separator') {
      if (normalized.length === 0 || normalized.at(-1)?.type === 'separator') return
      normalized.push({ type: 'separator' })
      return
    }

    if (!item.id && !item.role) return
    normalized.push(item)
  })

  if (normalized.at(-1)?.type === 'separator') normalized.pop()
  return normalized
}

export function clampMenuPosition({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  inset = 8,
  topInset = inset
}) {
  const maxLeft = Math.max(inset, viewportWidth - width - inset)
  const maxTop = Math.max(topInset, viewportHeight - height - inset)

  return {
    left: clamp(x, inset, maxLeft),
    top: clamp(y, topInset, maxTop)
  }
}

export function nextEnabledMenuIndex(items, currentIndex, direction) {
  if (!items.length) return -1

  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (currentIndex + direction * offset + items.length) % items.length
    const item = items[index]
    if (item?.type !== 'separator' && item?.enabled !== false) return index
  }

  return -1
}
