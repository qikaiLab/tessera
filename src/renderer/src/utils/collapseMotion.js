export const COLLAPSE_MIN_MS = 240
export const COLLAPSE_MAX_MS = 620
const COLLAPSE_BASE_MS = 210
const COLLAPSE_MS_PER_PX = 0.45

// A fixed duration makes a long entry cross a huge distance in the same time as a short
// one, so it looks like it snaps. Scale the time with the distance instead, within limits
// that keep short entries snappy and long ones from dragging.
export function collapseDurationMs(contentHeight) {
  const height = Number.isFinite(contentHeight) ? Math.max(0, contentHeight) : 0
  const ms = COLLAPSE_BASE_MS + height * COLLAPSE_MS_PER_PX
  return Math.round(Math.min(COLLAPSE_MAX_MS, Math.max(COLLAPSE_MIN_MS, ms)))
}
