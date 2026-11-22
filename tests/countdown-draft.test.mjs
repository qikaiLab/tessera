import { describe, expect, it } from 'vitest'
import { COUNTDOWN_COLORS, MAX_NOTE_LENGTH, readCountdown } from '../src/renderer/src/utils/countdowns.js'
import {
  cleanEvery,
  draftFromCountdown,
  emptyDraft,
  fieldsOfDraft,
  patchForChange,
  suggestColor,
  validateDraft,
  validateEvery
} from '../src/renderer/src/pages/Calendar/countdownDraft.js'

const good = { name: '考试', date: '2026-12-12', unit: '', every: '1', color: '#f87171', note: '' }

describe('the countdown form of the drawer', () => {
  it('starts empty, and is made from a stored countdown without losing a field', () => {
    expect(emptyDraft()).toEqual({ name: '', date: '', unit: '', every: '1', color: COUNTDOWN_COLORS[0], note: '' })
    expect(emptyDraft({ date: '2026-03-01', color: '#34d399' })).toMatchObject({ date: '2026-03-01', color: '#34d399' })

    const countdown = readCountdown({ id: 1, name: '生日', date: '2000-05-20', color: '#f472b6', repeat: { unit: 'year', every: 2 }, note: '蛋糕' }, 'id:1')
    expect(draftFromCountdown(countdown)).toEqual({ name: '生日', date: '2000-05-20', unit: 'year', every: '2', color: '#f472b6', note: '蛋糕' })
    // A countdown with nothing readable still gives a draft the form can show.
    expect(draftFromCountdown(readCountdown(null, 'index:0'))).toEqual({ name: '', date: '', unit: '', every: '1', color: COUNTDOWN_COLORS[0], note: '' })
  })

  it('says what is wrong with each field', () => {
    expect(validateDraft(good)).toEqual({ name: '', date: '', every: '' })
    expect(validateDraft({ ...good, name: '  ', date: '' })).toEqual({ name: '请填写倒数日名称', date: '请选择日期', every: '' })
    expect(validateDraft({ ...good, date: '0002-01-01' }).date).toBe('日期超出范围')
    // The step only matters once something repeats.
    expect(validateDraft({ ...good, every: '' }).every).toBe('')
    expect(validateDraft({ ...good, unit: 'week', every: '' }).every).not.toBe('')
    expect(validateDraft({ ...good, unit: 'week', every: '0' }).every).not.toBe('')
    expect(validateDraft({ ...good, unit: 'week', every: '100' }).every).not.toBe('')
    expect(validateDraft({ ...good, unit: 'week', every: '12' }).every).toBe('')
  })

  it('keeps only digits in the step, and as many as a step can have', () => {
    expect(cleanEvery('1a2')).toBe('12')
    expect(cleanEvery('-3')).toBe('3')
    expect(cleanEvery('12345')).toBe('12')
    expect(cleanEvery('')).toBe('')
    expect(validateEvery('7')).toBe('')
    expect(validateEvery('abc')).not.toBe('')
  })

  it('turns a draft into the fields that are stored', () => {
    expect(fieldsOfDraft({ ...good, unit: 'month', every: '3', note: ' 带笔 ' })).toEqual({
      name: '考试', date: '2026-12-12', color: '#f87171', repeat: { unit: 'month', every: 3 }, note: ' 带笔 '
    })
    expect(fieldsOfDraft(good).repeat).toBeNull()
    expect(fieldsOfDraft({ ...good, note: 'x'.repeat(500) }).note).toHaveLength(MAX_NOTE_LENGTH)
  })

  it('stores a change only when the field is valid, so a half-typed value never reaches the file', () => {
    expect(patchForChange(good, ['name'])).toEqual({ name: '考试' })
    expect(patchForChange({ ...good, name: '' }, ['name'])).toEqual({})
    expect(patchForChange({ ...good, date: '0002-01-01' }, ['date'])).toEqual({})
    expect(patchForChange({ ...good, date: '2027-01-01' }, ['date'])).toEqual({ date: '2027-01-01' })
    expect(patchForChange({ ...good, color: '#34d399' }, ['color'])).toEqual({ color: '#34d399' })
    expect(patchForChange({ ...good, note: '带笔' }, ['note'])).toEqual({ note: '带笔' })
    // A field that did not change is left alone, even when it is wrong.
    expect(patchForChange({ ...good, name: '' }, ['color'])).toEqual({ color: '#f87171' })
  })

  it('stores the repeat as a unit and a step, and clears it with "不重复"', () => {
    expect(patchForChange({ ...good, unit: 'year', every: '1' }, ['unit'])).toEqual({ repeat: { unit: 'year', every: 1 } })
    expect(patchForChange({ ...good, unit: 'week', every: '2' }, ['every'])).toEqual({ repeat: { unit: 'week', every: 2 } })
    expect(patchForChange({ ...good, unit: 'week', every: '' }, ['every'])).toEqual({})
    expect(patchForChange({ ...good, unit: '' }, ['unit'])).toEqual({ repeat: null })
  })

  it('suggests the colour used least so far', () => {
    expect(suggestColor([])).toBe(COUNTDOWN_COLORS[0])
    expect(suggestColor([{ color: COUNTDOWN_COLORS[0] }])).toBe(COUNTDOWN_COLORS[1])
    expect(suggestColor(COUNTDOWN_COLORS.map(color => ({ color })))).toBe(COUNTDOWN_COLORS[0])
    expect(suggestColor([...COUNTDOWN_COLORS, COUNTDOWN_COLORS[0]].map(color => ({ color })))).toBe(COUNTDOWN_COLORS[1])
    // Colours that are not in the palette do not count.
    expect(suggestColor([{ color: null }, { color: 'red' }])).toBe(COUNTDOWN_COLORS[0])
  })
})
