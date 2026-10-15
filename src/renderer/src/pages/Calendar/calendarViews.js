import { format, startOfWeek } from 'date-fns'

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

// Identifies the period on screen, so only a real change of month / week / year replays the entrance.
export function periodKey(view, cursor) {
  if (view === 'month') return format(cursor, 'yyyy-MM')
  if (view === 'week') return format(startOfWeek(cursor, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  return format(cursor, 'yyyy')
}

// Entrance delay of a cell: a soft diagonal sweep from the top left.
export const cellDelay = (row, column) => ({ '--cell-delay': `${row * 34 + column * 12}ms` })
