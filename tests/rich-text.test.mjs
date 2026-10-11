import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { isSafeLink, parseRichText, richTextToPlainText } from '../src/renderer/src/utils/richText.js'
import { formatRangeLabel, getPresetRange } from '../src/renderer/src/utils/timelineRange.js'
import RichTextView from '../src/renderer/src/components/RichTextView.jsx'

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const paragraph = (...content) => ({ type: 'paragraph', content })
const doc = (...content) => ({ type: 'doc', content })
const render = (value, props) => renderToStaticMarkup(React.createElement(RichTextView, { value, ...props }))

describe('parseRichText', () => {
  it('accepts objects, serialized documents and legacy plain text', () => {
    const source = doc(paragraph(text('你好')))
    expect(parseRichText(source)).toBe(source)
    expect(parseRichText(JSON.stringify(source))).toEqual(source)
    expect(parseRichText('第一行\n第二行').content).toHaveLength(2)
  })

  it('never throws on empty or odd input', () => {
    expect(parseRichText(undefined).content).toEqual([])
    expect(parseRichText('').content).toEqual([])
    expect(parseRichText('{broken').content[0].content[0].text).toBe('{broken')
  })

  it('flattens a document to plain text with line breaks between blocks', () => {
    expect(richTextToPlainText(doc(paragraph(text('甲')), paragraph(text('乙'))))).toBe('甲\n乙')
  })

  it('only treats web, mail and phone links as safe', () => {
    expect(isSafeLink('https://example.com')).toBe(true)
    expect(isSafeLink('mailto:a@b.c')).toBe(true)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
    expect(isSafeLink('file:///C:/secret')).toBe(false)
    expect(isSafeLink(undefined)).toBe(false)
  })
})

describe('RichTextView', () => {
  it('renders paragraphs, headings, marks and lists', () => {
    const html = render(doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('标题')] },
      paragraph(text('粗体', [{ type: 'bold' }]), text(' 和 '), text('斜体', [{ type: 'italic' }])),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('项目'))] }] },
      { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [paragraph(text('第三'))] }] }
    ))
    expect(html).toContain('<h2>标题</h2>')
    expect(html).toContain('<strong>粗体</strong>')
    expect(html).toContain('<em>斜体</em>')
    expect(html).toContain('<ul><li><p>项目</p></li></ul>')
    expect(html).toContain('<ol start="3">')
  })

  it('renders task lists read-only with their checked state', () => {
    const html = render(doc({
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('完成'))] },
        { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('待办'))] }
      ]
    }))
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('data-checked="true"')
    expect(html).toContain('disabled=""')
  })

  it('drops unsafe link targets but keeps the text', () => {
    const html = render(doc(paragraph(text('点我', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]))))
    expect(html).not.toContain('javascript:')
    expect(html).toContain('点我')
    const safe = render(doc(paragraph(text('官网', [{ type: 'link', attrs: { href: 'https://example.com' } }]))))
    expect(safe).toContain('href="https://example.com"')
  })

  it('highlights search matches without breaking markup characters', () => {
    const html = render(doc(paragraph(text('a<b> 关键词 c'))), { highlight: '关键词' })
    expect(html).toContain('<mark>关键词</mark>')
    expect(html).toContain('a&lt;b&gt;')
  })

  it('tolerates unknown nodes and empty documents', () => {
    expect(render(doc({ type: 'mystery', content: [paragraph(text('内容'))] }))).toContain('内容')
    expect(render(undefined)).toContain('rich-view')
  })
})

describe('getPresetRange', () => {
  const today = new Date(2026, 4, 17)

  it('covers the last N days including today', () => {
    expect(getPresetRange('7', today)).toEqual({ from: '2026-05-11', to: '2026-05-17' })
    expect(getPresetRange('30', today)).toEqual({ from: '2026-04-18', to: '2026-05-17' })
  })

  it('supports this month, this year and no limit', () => {
    expect(getPresetRange('month', today)).toEqual({ from: '2026-05-01', to: '2026-05-31' })
    expect(getPresetRange('year', today)).toEqual({ from: '2026-01-01', to: '2026-05-17' })
    expect(getPresetRange('all', today)).toEqual({ from: '', to: '' })
  })
})

describe('formatRangeLabel', () => {
  const today = new Date(2026, 4, 17)

  it('describes open, half-open and closed ranges', () => {
    expect(formatRangeLabel('', '', today)).toBe('全部时间')
    expect(formatRangeLabel('2026-05-01', '2026-05-17', today)).toBe('5月1日 – 5月17日')
    expect(formatRangeLabel('2026-05-01', '', today)).toBe('5月1日 起')
    expect(formatRangeLabel('', '2026-05-17', today)).toBe('截至 5月17日')
  })

  it('includes the year for dates outside the current year', () => {
    expect(formatRangeLabel('2025-12-01', '2026-01-10', today)).toBe('2025/12/1 – 1月10日')
  })
})
