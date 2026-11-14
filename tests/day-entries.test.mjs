import { describe, expect, it } from 'vitest'
import {
  dropEmptyEntries,
  hasStoredValue,
  isEntryEmpty,
  isSectionAddable,
  isSectionClosable,
  isSectionOnDay,
  storedText
} from '../src/renderer/src/utils/dayEntries.js'

const doc = (...texts) => JSON.stringify({
  type: 'doc',
  content: texts.map(text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }))
})

describe('isEntryEmpty', () => {
  it('treats missing and blank values as empty', () => {
    for (const value of [undefined, null, '', '   ']) expect(isEntryEmpty(value)).toBe(true)
  })

  it('treats a rich-text document without visible text as empty', () => {
    expect(isEntryEmpty(doc(''))).toBe(true)
    expect(isEntryEmpty(doc('', '  '))).toBe(true)
    expect(isEntryEmpty(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }))).toBe(true)
  })

  it('keeps numbers, including zero, and any real text', () => {
    expect(isEntryEmpty('0')).toBe(false)
    expect(isEntryEmpty('7.8')).toBe(false)
    expect(isEntryEmpty(doc('今天'))).toBe(false)
    expect(isEntryEmpty('plain legacy text')).toBe(false)
  })
})

describe('isSectionClosable', () => {
  const optional = { id: 'extra', resident: false }
  const resident = { id: 'diary', resident: true }

  it('lets an optional section with nothing in it be closed', () => {
    expect(isSectionClosable(optional, undefined)).toBe(true)
    expect(isSectionClosable(optional, { value: '' })).toBe(true)
    expect(isSectionClosable(optional, { value: doc('') })).toBe(true)
  })

  it('does not offer to close a section that holds data, or a resident one', () => {
    expect(isSectionClosable(optional, { value: '0' })).toBe(false)
    expect(isSectionClosable(optional, { value: doc('写了点东西') })).toBe(false)
    expect(isSectionClosable(resident, undefined)).toBe(false)
  })
})

describe('which sections are on a day', () => {
  const resident = { id: 'diary', resident: true }
  const optional = { id: 'extra', resident: false }

  it('always shows resident sections', () => {
    expect(isSectionOnDay(resident, undefined)).toBe(true)
    expect(isSectionAddable(resident, undefined)).toBe(false)
  })

  it('shows an optional section once it holds something', () => {
    expect(isSectionOnDay(optional, undefined)).toBe(false)
    expect(isSectionOnDay(optional, { value: '3' })).toBe(true)
    expect(hasStoredValue({ value: '  ' })).toBe(false)
    expect(hasStoredValue({ value: 0 })).toBe(true)
  })

  it('keeps an optional section on screen when it was added by hand or is folding away', () => {
    expect(isSectionOnDay(optional, undefined, { added: true })).toBe(true)
    expect(isSectionOnDay(optional, undefined, { leaving: true })).toBe(true)
  })

  it('offers only optional sections that are neither stored nor already added', () => {
    expect(isSectionAddable(optional, undefined)).toBe(true)
    expect(isSectionAddable(optional, { value: '1' })).toBe(false)
    expect(isSectionAddable(optional, undefined, true)).toBe(false)
  })
})

describe('values a damaged file can hold', () => {
  // An object whose conversion to text throws: nothing the app writes, but a hand-edited file can.
  const unreadable = { toString: null }

  it('are kept as something stored instead of throwing or being dropped', () => {
    expect(isEntryEmpty(unreadable)).toBe(false)
    expect(hasStoredValue({ value: unreadable })).toBe(true)
    expect(dropEmptyEntries({ a: { value: unreadable }, b: { value: '' } })).toEqual({ a: { value: unreadable } })
  })

  it('read as no text at all', () => {
    expect(storedText(unreadable)).toBe('')
    expect(storedText(undefined)).toBe('')
    expect(storedText(12)).toBe('12')
  })
})
