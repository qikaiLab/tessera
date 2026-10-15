/** `value` limited to the range from `min` to `max`. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
