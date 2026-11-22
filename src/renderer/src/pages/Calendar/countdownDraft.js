import {
  COUNTDOWN_COLORS,
  MAX_NOTE_LENGTH,
  MAX_REPEAT_EVERY,
  validateDate,
  validateName
} from '../../utils/countdowns'

// The form of one countdown as the drawer edits it: every field is the text of its control, so a
// half-typed value is never mistaken for a real one. `unit` is '' for "does not repeat".

export function emptyDraft({ date = '', color = COUNTDOWN_COLORS[0] } = {}) {
  return { name: '', date, unit: '', every: '1', color, note: '' }
}

/** The draft of a countdown read by readCountdown. */
export function draftFromCountdown(countdown) {
  return {
    name: countdown.name,
    date: countdown.date,
    unit: countdown.repeat?.unit ?? '',
    every: String(countdown.repeat?.every ?? 1),
    color: countdown.color ?? COUNTDOWN_COLORS[0],
    note: countdown.note
  }
}

export function validateEvery(text) {
  if (!/^\d+$/.test(text)) return `请填写 1–${MAX_REPEAT_EVERY}`
  const every = Number(text)
  return every >= 1 && every <= MAX_REPEAT_EVERY ? '' : `请填写 1–${MAX_REPEAT_EVERY}`
}

/** What is wrong with each field of a draft: '' when it is fine. */
export function validateDraft(draft) {
  return {
    name: validateName(draft.name),
    date: validateDate(draft.date),
    every: draft.unit ? validateEvery(draft.every) : ''
  }
}

/** Only digits, as many as a step can have. */
export function cleanEvery(text) {
  return String(text).replace(/\D/g, '').slice(0, String(MAX_REPEAT_EVERY).length)
}

/** The repeat of a draft ({ unit, every }, or null for "does not repeat"). */
export function repeatOfDraft(draft) {
  return draft.unit ? { unit: draft.unit, every: Number(draft.every) } : null
}

/** The draft as the fields addCountdown takes. */
export function fieldsOfDraft(draft) {
  return {
    name: draft.name,
    date: draft.date,
    color: draft.color,
    repeat: repeatOfDraft(draft),
    note: draft.note.slice(0, MAX_NOTE_LENGTH)
  }
}

/**
 * What to store after a change to the fields named in `changed`: only the fields that are valid
 * now, as an updateCountdown patch. A field that is still wrong keeps its last good value on disk.
 */
export function patchForChange(draft, changed) {
  const problems = validateDraft(draft)
  const patch = {}
  if (changed.includes('name') && !problems.name) patch.name = draft.name
  if (changed.includes('date') && !problems.date) patch.date = draft.date
  if (changed.includes('color')) patch.color = draft.color
  if (changed.includes('note')) patch.note = draft.note
  if ((changed.includes('unit') || changed.includes('every')) && !problems.every) patch.repeat = repeatOfDraft(draft)
  return patch
}

/** The colour a new countdown starts with: the one least used so far, so neighbours differ. */
export function suggestColor(countdowns) {
  const used = new Map(COUNTDOWN_COLORS.map(color => [color, 0]))
  for (const item of countdowns) if (used.has(item.color)) used.set(item.color, used.get(item.color) + 1)
  let best = COUNTDOWN_COLORS[0]
  for (const color of COUNTDOWN_COLORS) if (used.get(color) < used.get(best)) best = color
  return best
}
