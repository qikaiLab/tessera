import { describe, expect, it } from 'vitest'
import { buildContentExtensions } from '../src/renderer/src/components/TiptapEditor/contentExtensions.js'
import {
  createMarkdownParser,
  docHasNode,
  imagesToLinks,
  looksLikeMarkdown,
  shouldPasteAsMarkdown
} from '../src/renderer/src/components/TiptapEditor/markdownPaste.js'
import { extractPlainText, richTextToPlainText } from '../src/renderer/src/utils/richText.js'
import { getSectionPreview } from '../src/renderer/src/utils/sectionPreview.js'

const parse = createMarkdownParser(buildContentExtensions())

function collect(node, type, found = []) {
  if (node?.type === type) found.push(node)
  for (const child of node?.content || []) collect(child, type, found)
  return found
}

describe('looksLikeMarkdown', () => {
  it('recognises headings, fences, tables, lists and inline syntax', () => {
    expect(looksLikeMarkdown('# 标题\n正文')).toBe(true)
    expect(looksLikeMarkdown('```js\nlet a = 1\n```')).toBe(true)
    expect(looksLikeMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe(true)
    expect(looksLikeMarkdown('- one\n- two')).toBe(true)
    expect(looksLikeMarkdown('1. one\n2. two')).toBe(true)
    expect(looksLikeMarkdown('> a\n> b')).toBe(true)
    expect(looksLikeMarkdown('今天 **很重要**')).toBe(true)
    expect(looksLikeMarkdown('运行 `npm run check`')).toBe(true)
    expect(looksLikeMarkdown('见 [文档](https://example.com)')).toBe(true)
  })

  it('leaves ordinary text alone', () => {
    for (const text of [
      '',
      '   ',
      '今天骑了 80 km，天气不错。',
      '2 * 3 * 4 = 24',
      'snake_case_name and a*b',
      '- 只有一行像列表',
      'a | b | c',
      '#没有空格的标签',
      'price: 5-10 yuan'
    ]) {
      expect(looksLikeMarkdown(text)).toBe(false)
    }
  })

  it('never converts huge pastes', () => {
    expect(looksLikeMarkdown(`# title\n${'x'.repeat(250_000)}`)).toBe(false)
  })
})

describe('shouldPasteAsMarkdown', () => {
  it('converts plain text, and text wrapped only in styled spans (a code editor)', () => {
    expect(shouldPasteAsMarkdown({ text: '# a\n- b\n- c', html: '' })).toBe(true)
    expect(shouldPasteAsMarkdown({
      text: '# a\n- b\n- c',
      html: '<div style="color:#ccc"><span style="color:#569cd6"># a</span></div>'
    })).toBe(true)
  })

  it('keeps real rich text, and anything copied inside the editor, as it is', () => {
    expect(shouldPasteAsMarkdown({ text: '# a\n- b\n- c', html: '<h1>a</h1><ul><li>b</li></ul>' })).toBe(false)
    expect(shouldPasteAsMarkdown({ text: '**x**', html: '<p>x <strong>y</strong></p>' })).toBe(false)
    expect(shouldPasteAsMarkdown({ text: '**x**', html: '<p data-pm-slice="1 1 []">**x**</p>' })).toBe(false)
  })
})

describe('markdown parser', () => {
  it('builds the editor nodes for the supported syntax', () => {
    const doc = parse('# 标题\n\n第一行\n第二行 **粗** ~~删~~ `码`\n\n- [ ] 待办\n- [x] 完成\n\n> 引用\n\n---')
    expect(collect(doc, 'heading')[0].attrs.level).toBe(1)
    expect(collect(doc, 'hardBreak')).toHaveLength(1)
    expect(collect(doc, 'taskItem').map(item => item.attrs.checked)).toEqual([false, true])
    expect(collect(doc, 'blockquote')).toHaveLength(1)
    expect(collect(doc, 'horizontalRule')).toHaveLength(1)
    const marks = collect(doc, 'text').flatMap(node => (node.marks || []).map(mark => mark.type))
    expect(marks).toEqual(expect.arrayContaining(['bold', 'strike', 'code']))
  })

  it('parses a table with a header row', () => {
    const doc = parse('| 项目 | 数量 |\n| --- | :-: |\n| 机油 | 2 |\n| 滤芯 | 1 |')
    expect(docHasNode(doc, 'table')).toBe(true)
    expect(collect(doc, 'tableRow')).toHaveLength(3)
    expect(collect(doc, 'tableHeader')).toHaveLength(2)
    expect(collect(doc, 'tableCell')).toHaveLength(4)
    expect(extractPlainText(doc)).toContain('机油 2')
  })

  it('never produces empty text nodes, which the editor schema rejects', () => {
    const doc = parse('**a** `b` ~~c~~ [d](https://example.com)')
    expect(collect(doc, 'text').every(node => node.text.length > 0)).toBe(true)
  })

  it('keeps safe links, adds https to www and drops unsafe addresses', () => {
    const doc = parse('[a](https://example.com) [b](www.example.com) [c](javascript:alert(1)) [d](file:///C:/x) [e](mailto:me@example.com)')
    const links = collect(doc, 'text')
      .filter(node => node.marks?.some(mark => mark.type === 'link'))
      .map(node => [node.text, node.marks.find(mark => mark.type === 'link').attrs.href])
    expect(links).toEqual([
      ['a', 'https://example.com'],
      ['b', 'https://www.example.com'],
      ['e', 'mailto:me@example.com']
    ])
    const text = extractPlainText(doc)
    expect(text).toContain('c')
    expect(text).toContain('d')
  })

  it('keeps an image address as a link, but not inside fenced code', () => {
    expect(imagesToLinks('![封面](https://example.com/a.png "t")')).toBe('[封面](https://example.com/a.png)')
    expect(imagesToLinks('![](https://example.com/a.png)')).toBe('[图片](https://example.com/a.png)')
    expect(imagesToLinks('```\n![x](y)\n```')).toBe('```\n![x](y)\n```')
    const doc = parse('![封面](https://example.com/a.png)')
    expect(collect(doc, 'text')[0].marks[0].attrs.href).toBe('https://example.com/a.png')
  })

  it('does not turn raw HTML into elements', () => {
    const doc = parse('<script>alert(1)</script>\n\n**x**')
    expect(JSON.stringify(doc)).not.toContain('"type":"script"')
  })
})

describe('tables in stored documents', () => {
  const table = {
    type: 'table',
    content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] }
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'y' }] }] }
      ] }
    ]
  }
  const doc = { type: 'doc', content: [table] }

  it('keeps cells apart in search text and previews', () => {
    expect(extractPlainText(doc)).toBe('A B x y ')
    expect(richTextToPlainText(doc).split('\n')).toEqual(['A', 'B', 'x', 'y'])
    expect(getSectionPreview(doc)).toBe('A B x y')
  })
})
