import fc from 'fast-check'

// Shared generators for the fuzz tests. A failure prints its seed; set FUZZ_SEED=<number> to replay
// it, and FUZZ_RUNS=<number> to run more (or fewer) cases per property.
export const NUM_RUNS = Number(process.env.FUZZ_RUNS) || 300
export const fuzzParams = (overrides = {}) => ({
  numRuns: NUM_RUNS,
  ...(process.env.FUZZ_SEED ? { seed: Number(process.env.FUZZ_SEED) } : {}),
  ...overrides
})

// Text a person might really type or paste, plus the troublemakers: control characters, lone
// surrogates, zero-width and bidirectional marks, emoji sequences, very long runs.
const nasty = fc.constantFrom(
  '', ' ', '\n', '\r\n', '\t', '\u0000', '\u0007', '\u200b', '\u202e', '\ufeff', '\u2028', '\u2029',
  '\ud800', '\udc00', '😀', '👨‍👩‍👧‍👦', '🇨🇳', 'é', 'é', '日本語', 'العربية', '𠮷', '<script>alert(1)</script>',
  '"quoted"', "'single'", '\\', '\\u0000', '{', '}', '[', ']', '%00', '../', '..\\', 'C:\\Windows', '${x}', '`tick`'
)
export const anyText = fc.oneof(
  { weight: 4, arbitrary: fc.string({ unit: 'binary', maxLength: 60 }) },
  { weight: 2, arbitrary: fc.string({ unit: 'grapheme', maxLength: 60 }) },
  { weight: 2, arbitrary: nasty },
  { weight: 1, arbitrary: fc.array(nasty, { maxLength: 8 }).map(parts => parts.join('')) },
  { weight: 1, arbitrary: fc.nat({ max: 40_000 }).map(length => 'x'.repeat(length)) }
)

const MARKS = ['bold', 'italic', 'underline', 'strike', 'code', 'link', 'highlight', 'subscript', 'unknownMark']
const mark = fc.record({ type: fc.constantFrom(...MARKS) }, { noNullPrototype: true })
const textNode = fc.record({
  type: fc.constant('text'),
  text: anyText,
  marks: fc.option(fc.array(mark, { maxLength: 3 }), { nil: undefined })
}, { requiredKeys: ['type', 'text'], noNullPrototype: true })

// A Tiptap-ish document: mostly the node types the editor knows, some it does not, nested a few levels deep.
const BLOCKS = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'table', 'horizontalRule', 'image', 'mysteryNode', 'listItem', 'taskItem', 'tableRow', 'tableCell', 'tableHeader']
const attrValue = fc.oneof(fc.integer(), fc.boolean(), fc.string({ maxLength: 8 }), fc.constant(null))
export const docNode = fc.letrec(tie => ({
  node: fc.oneof(
    { weight: 3, arbitrary: textNode },
    {
      weight: 2,
      arbitrary: fc.record({
        type: fc.constantFrom(...BLOCKS),
        attrs: fc.option(fc.dictionary(fc.constantFrom('level', 'checked', 'colspan', 'colwidth', 'language', 'x'), attrValue, { noNullPrototype: true }), { nil: undefined }),
        content: fc.option(fc.array(tie('node'), { maxLength: 4 }), { nil: undefined })
      }, { requiredKeys: ['type'], noNullPrototype: true })
    }
  )
})).node

export const anyDocument = fc.record({
  type: fc.constant('doc'),
  content: fc.array(docNode, { maxLength: 6 })
}, { noNullPrototype: true })

// Documents built only from what the editor really holds, so every one of them is valid as it is.
const plain = fc.string({ minLength: 1, maxLength: 30 }).filter(text => text.trim() !== '')
// A code mark excludes the others, and a node cannot carry the same mark twice.
const knownMarks = fc.oneof(
  fc.constant([{ type: 'code' }]),
  fc.uniqueArray(fc.constantFrom('bold', 'italic', 'underline', 'strike'), { maxLength: 3 }).map(types => types.map(type => ({ type })))
)
const inline = fc.array(
  fc.record({ type: fc.constant('text'), text: plain, marks: fc.option(knownMarks, { nil: undefined }) }, { requiredKeys: ['type', 'text'], noNullPrototype: true }),
  { minLength: 1, maxLength: 3 }
)
const paragraphOf = content => ({ type: 'paragraph', content })
const validBlock = fc.oneof(
  inline.map(paragraphOf),
  fc.record({ type: fc.constant('heading'), attrs: fc.record({ level: fc.integer({ min: 1, max: 6 }) }, { noNullPrototype: true }), content: inline }, { noNullPrototype: true }),
  fc.array(inline, { minLength: 1, maxLength: 3 }).map(items => ({ type: 'bulletList', content: items.map(item => ({ type: 'listItem', content: [paragraphOf(item)] })) })),
  fc.array(fc.tuple(fc.boolean(), inline), { minLength: 1, maxLength: 3 }).map(items => ({ type: 'taskList', content: items.map(([checked, item]) => ({ type: 'taskItem', attrs: { checked }, content: [paragraphOf(item)] })) })),
  inline.map(item => ({ type: 'blockquote', content: [paragraphOf(item)] })),
  plain.map(text => ({ type: 'codeBlock', content: [{ type: 'text', text }] })),
  fc.constant({ type: 'horizontalRule' }),
  fc.constant({ type: 'paragraph' })
)
export const validDocument = fc.record({ type: fc.constant('doc'), content: fc.array(validBlock, { minLength: 1, maxLength: 6 }) }, { noNullPrototype: true })

// A tree that only looks like a document: nodes with no type or an odd one, content that is not a
// list, null children, text that is not a string. What a hand-edited or half-corrupted file holds.
export const malformedNode = fc.letrec(tie => ({
  node: fc.oneof(
    { weight: 2, arbitrary: fc.jsonValue({ maxDepth: 2 }) },
    {
      weight: 4,
      arbitrary: fc.record({
        type: fc.oneof(fc.constantFrom('doc', 'paragraph', 'heading', 'codeBlock', 'text', 'tableCell', 'tableRow', 'bulletList', 'listItem'), fc.jsonValue({ maxDepth: 1 })),
        content: fc.oneof(fc.array(tie('node'), { maxLength: 4 }), fc.jsonValue({ maxDepth: 2 })),
        text: fc.oneof(fc.string({ maxLength: 10 }), fc.jsonValue({ maxDepth: 1 })),
        attrs: fc.jsonValue({ maxDepth: 2 }),
        marks: fc.jsonValue({ maxDepth: 2 })
      }, { requiredKeys: [], noNullPrototype: true })
    }
  )
})).node

// Any JSON value at all, as the parsed form of a file that is damaged or from somewhere else.
export const anyJson = fc.jsonValue({ maxDepth: 5 })

// A stored value as the data directory might hold it: a document, its text, text of another kind,
// or something that is not a document at all.
export const storedValue = fc.oneof(
  anyDocument,
  malformedNode,
  malformedNode.map(node => JSON.stringify(node)),
  malformedNode.map(node => JSON.stringify({ type: 'doc', content: [node] })),
  anyDocument.map(doc => JSON.stringify(doc)),
  anyText,
  anyJson,
  anyJson.map(value => JSON.stringify(value)),
  fc.constantFrom(undefined, null, 0, 1, -1, NaN, Infinity, true, false, '', '0', 'null', '[]', '{}', '{"type":"doc"}', '{"type":"doc","content":null}')
)
