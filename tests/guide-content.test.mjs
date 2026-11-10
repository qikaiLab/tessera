import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Onboarding from '../src/renderer/src/components/Onboarding.jsx'
import {
  GUIDE_TOPICS,
  plainGuideText,
  searchTopics
} from '../src/renderer/src/components/guide/guideTopics.js'

const SOURCE_ROOT = path.resolve('src/renderer/src')

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(jsx?|mjs)$/.test(entry.name) && !full.includes(`${path.sep}guide${path.sep}`) ? [full] : []
  })
}

// Everything the app itself prints, i.e. the screen text the guide may refer to.
const appSource = sourceFiles(SOURCE_ROOT).map(file => fs.readFileSync(file, 'utf8')).join('\n')

function allText(topic) {
  return topic.blocks.flatMap(block => [
    block.text,
    block.label,
    ...(block.items || []),
    ...(block.head || []),
    ...(block.rows || []).flat()
  ]).filter(Boolean)
}

describe('guide topics', () => {
  it('have unique ids, titles, and content in every topic', () => {
    expect(new Set(GUIDE_TOPICS.map(topic => topic.id)).size).toBe(GUIDE_TOPICS.length)
    expect(new Set(GUIDE_TOPICS.map(topic => topic.title)).size).toBe(GUIDE_TOPICS.length)
    for (const topic of GUIDE_TOPICS) {
      expect(topic.title).toBeTruthy()
      expect(topic.blurb).toBeTruthy()
      expect(topic.blocks.length).toBeGreaterThan(1)
    }
  })

  it('only use block shapes the guide can draw, and well-formed tables', () => {
    const known = new Set(['h', 'p', 'list', 'steps', 'table', 'tip', 'warn', 'action'])
    for (const topic of GUIDE_TOPICS) {
      for (const block of topic.blocks) {
        expect(known.has(block.t)).toBe(true)
        if (block.t === 'table') {
          expect(block.head.length).toBeGreaterThan(0)
          for (const row of block.rows) expect(row).toHaveLength(block.head.length)
        }
        if (block.t === 'list' || block.t === 'steps') expect(block.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('leave no unbalanced inline markers', () => {
    for (const topic of GUIDE_TOPICS) {
      for (const text of allText(topic)) {
        expect((text.match(/\*\*/g) || []).length % 2).toBe(0)
        expect((text.match(/\[\[/g) || []).length).toBe((text.match(/\]\]/g) || []).length)
      }
    }
  })

  it('cover every page of the app', () => {
    const titles = GUIDE_TOPICS.map(topic => topic.title).join(' ')
    for (const page of ['记录', '便签', '时间线', '日历', '数据分析', '设置', '表格', '快捷键']) {
      expect(titles).toContain(page)
    }
  })
})

// The guide quotes buttons and labels in 「」. When one is renamed in the app, the guide must
// follow, otherwise a reader is sent looking for something that is not on the screen.
describe('guide references to the screen', () => {
  // Not printed verbatim: a placeholder, and labels the app assembles ("月" + "视图"). Topic titles are fine too.
  const PLACEHOLDERS = new Set(['+ 版块名', '月视图', '周视图', '年视图', ...GUIDE_TOPICS.map(topic => topic.title)])
  const quoted = GUIDE_TOPICS.flatMap(topic =>
    allText(topic).flatMap(text => [...plainGuideText(text).matchAll(/「([^」]+)」/g)].map(match => match[1]))
  )
    .flatMap(label => label.split(/→| \/ /).map(part => part.trim()))
    .filter(label => label && !PLACEHOLDERS.has(label))

  it('finds the quoted labels, so this check is not vacuous', () => {
    expect(quoted.length).toBeGreaterThan(40)
  })

  it('only quotes labels that the app prints', () => {
    const missing = [...new Set(quoted)].filter(label => {
      // Labels that start with a decoration (+, ⊕, ★ …) are matched by the words after it.
      const words = label.replace(/^[^\p{L}\p{N}]+/u, '')
      return !appSource.includes(words)
    })
    expect(missing).toEqual([])
  })
})

describe('searchTopics', () => {
  it('returns every topic for an empty query', () => {
    expect(searchTopics('')).toHaveLength(GUIDE_TOPICS.length)
    expect(searchTopics('   ')).toHaveLength(GUIDE_TOPICS.length)
  })

  it('finds topics by words in their text, ignoring case and markers', () => {
    expect(searchTopics('表格').map(topic => topic.id)).toContain('tables')
    expect(searchTopics('CTRL').length).toBeGreaterThan(0)
    expect(searchTopics('备份').map(topic => topic.id)).toContain('settings')
  })

  it('needs every word to match, and returns nothing for gibberish', () => {
    expect(searchTopics('表格 合并').map(topic => topic.id)).toContain('tables')
    expect(searchTopics('zzzzqqqq')).toEqual([])
  })
})

describe('the guide dialog', () => {
  const render = props => renderToStaticMarkup(React.createElement(Onboarding, { onDone() {}, onOpenShortcuts() {}, ...props }))

  it('lists every topic and opens the first one', () => {
    const html = render()
    for (const topic of GUIDE_TOPICS) expect(html).toContain(topic.title)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('快速开始')
  })

  it('labels the closing button for a first run', () => {
    expect(render({ firstRun: true })).toContain('开始使用')
    expect(render({ firstRun: false })).not.toContain('开始使用')
  })
})
