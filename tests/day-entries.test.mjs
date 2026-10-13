import { describe, expect, it } from 'vitest'
import { isEntryEmpty, isSectionClosable } from '../src/renderer/src/utils/dayEntries.js'

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
