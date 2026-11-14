// Fills the development data directory with realistic sample records so features can be
// tried without touching real data.
//
//   npm run seed:dev                 -> ~/Tessera-dev/data
//   npm run seed:dev -- <directory>  -> any other throwaway directory
//   SEED_DAYS=1100 npm run seed:dev  -> a three-year history
//
// The target is overwritten, so the script only writes into an empty directory or one it
// seeded before (marked by .tessera-dev-seed), and never into the real default data.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { MARKER, assertSafeTarget, writeJson } from './lib/seed-target.mjs'

// SEED_DAYS lets you generate a long history to try the app with years of records.
const DAYS = Number.parseInt(process.env.SEED_DAYS || '', 10) || 150
const OUTLIER_DAY = 9

const target = path.resolve(process.argv[2] || path.join(os.homedir(), 'Tessera-dev', 'data'))

// Small deterministic generator so every run produces the same sample history.
function createRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const text = value => ({ type: 'text', text: value })
const paragraph = value => ({ type: 'paragraph', content: value ? [text(value)] : [] })
const heading = (level, value) => ({ type: 'heading', attrs: { level }, content: [text(value)] })
const bulletList = items => ({
  type: 'bulletList',
  content: items.map(item => ({ type: 'listItem', content: [paragraph(item)] }))
})
const taskList = items => ({
  type: 'taskList',
  content: items.map(([done, item]) => ({
    type: 'taskItem',
    attrs: { checked: done },
    content: [paragraph(item)]
  }))
})
const doc = (...content) => ({ type: 'doc', content })

const DIARY_LINES = [
  '今天的节奏比较平稳，上午处理了积压的事情，下午出去走了走。',
  '晚饭后整理了桌面，顺便把下周要做的事情列了一遍。',
  '有点累，但是睡前读了二十页书，心情还不错。',
  '和朋友通了电话，聊到了很久以前的事情。',
  '天气转凉了，出门记得多带一件外套。',
  '写了一些代码，也修掉了一个拖了很久的问题。',
  '今天几乎没有碰电脑，把时间留给了散步和做饭。',
  '回顾了这个月的计划，进度比预期慢一点，但方向没有问题。'
]

const STUDY_TOPICS = ['线性代数', '操作系统', '英语听力', '数据结构', '概率论', '写作练习']

function createSections() {
  return [
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0, color: '#7c6aff' },
    { id: 'study', name: '学习笔记', type: 'text', unit: '', resident: false, order: 1, color: '#45b58a' },
    { id: 'workout', name: '训练记录', type: 'text', unit: '', resident: false, order: 2, color: '#d88d58' },
    { id: 'running', name: '今日跑步[m]', type: 'number', unit: 'm', resident: false, order: 3, color: '#5b8cff' },
    { id: 'sleep', name: '睡眠时长[h]', type: 'number', unit: 'h', resident: false, order: 4, color: '#e184a8', numberDefaultMode: 'carry' },
    { id: 'mood', name: '心情指数', type: 'number', unit: '', resident: false, order: 5, color: '#d9b24c' }
  ]
}

function dateParts(daysAgo) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  const pad = value => String(value).padStart(2, '0')
  return {
    year: String(date.getFullYear()),
    month: pad(date.getMonth() + 1),
    day: pad(date.getDate()),
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    stamp: date.toISOString()
  }
}

function createDay(daysAgo, random) {
  const entry = value => ({ value, updatedAt: dateParts(daysAgo).stamp })
  const day = {}

  const diary = [paragraph(DIARY_LINES[Math.floor(random() * DIARY_LINES.length)])]
  if (random() > 0.5) diary.push(paragraph(DIARY_LINES[Math.floor(random() * DIARY_LINES.length)]))
  if (daysAgo % 11 === 0) {
    diary.push(heading(2, '本周回顾'), bulletList(['完成了两个小目标', '没有熬夜', '周末安排了出游']))
    diary.push(taskList([[true, '整理房间'], [false, '预约体检'], [false, '回复邮件']]))
  }
  // A few very long entries to try collapsing and the back-to-top button.
  if (daysAgo === 0 || daysAgo === 3) {
    for (let i = 0; i < 40; i += 1) diary.push(paragraph(`第 ${i + 1} 段：${DIARY_LINES[i % DIARY_LINES.length]}`))
  }
  day.diary = entry(JSON.stringify(doc(...diary)))

  if (random() > 0.55) {
    const topic = STUDY_TOPICS[Math.floor(random() * STUDY_TOPICS.length)]
    day.study = entry(JSON.stringify(doc(
      heading(3, topic),
      paragraph('今天复习了重点章节，整理了几道典型题的解法。'),
      bulletList(['公式推导要再过一遍', '错题已加入本子'])
    )))
  }

  if (random() > 0.7) {
    day.workout = entry(JSON.stringify(doc(
      paragraph('深蹲 5×5，卧推 4×8，核心训练 15 分钟。'),
      taskList([[true, '热身'], [true, '力量'], [false, '拉伸']])
    )))
  }

  if (daysAgo === OUTLIER_DAY || random() > 0.4) {
    // One huge outlier makes it easy to check how the heatmap copes with skewed data.
    const distance = daysAgo === OUTLIER_DAY ? 38000 : Math.round(1500 + random() * 6500)
    day.running = entry(String(distance))
  }
  if (random() > 0.25) day.sleep = entry(String((5.5 + random() * 3).toFixed(1)))
  if (random() > 0.3) day.mood = entry(String(1 + Math.floor(random() * 5)))
  return day
}

function createNotes() {
  const now = new Date().toISOString()
  const today = dateParts(0).iso
  const weekAgo = dateParts(7).iso
  const make = (id, title, content, extra = {}) => ({
    id,
    title,
    content,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
    fontSize: 14,
    dateLink: null,
    ...extra
  })
  return [
    make('seed-note-1', '本月计划', doc(taskList([[true, '整理数据备份'], [false, '读完一本书'], [false, '体检']])), { pinned: true }),
    make('seed-note-2', '灵感池', doc(bulletList(['做一个周报模板', '试试新的跑步路线', '给朋友写封信']))),
    make('seed-note-3', '本周关注', doc(paragraph('这条便签关联了一段日期范围。')), {
      dateLink: { type: 'range', start: weekAgo, end: today }
    }),
    make('seed-note-4', '已归档的想法', doc(paragraph('用于测试归档列表。')), { archived: true })
  ]
}

function createMetadata() {
  const countdowns = [
    { id: 1, name: '期末考试', date: dateParts(-20).iso, color: '#f87171' },
    { id: 2, name: '旅行出发', date: dateParts(-45).iso, color: '#34d399' }
  ]
  const analytics = [
    {
      id: 'seed-chart-1', title: '跑步距离', type: 'line', dateRange: '90', dateAxisMode: 'recorded',
      lineStyle: 'smooth', dateFrom: '', dateTo: '', bindings: [{ sectionId: 'running', metric: 'value' }]
    },
    {
      id: 'seed-chart-2', title: '睡眠与心情', type: 'bar', dateRange: '30', dateAxisMode: 'continuous',
      lineStyle: 'smooth', dateFrom: '', dateTo: '',
      bindings: [{ sectionId: 'sleep', metric: 'value' }, { sectionId: 'mood', metric: 'value' }]
    },
    {
      id: 'seed-chart-3', title: '写作活跃度', type: 'heatmap', dateRange: '365', dateAxisMode: 'recorded',
      lineStyle: 'smooth', dateFrom: '', dateTo: '', bindings: [{ sectionId: 'diary', metric: 'wordcount' }]
    },
    {
      id: 'seed-chart-4', title: '跑步热力图', type: 'heatmap', dateRange: '90', dateAxisMode: 'recorded',
      lineStyle: 'smooth', dateFrom: '', dateTo: '', bindings: [{ sectionId: 'running', metric: 'value' }]
    }
  ]
  return { countdowns, analytics }
}

async function main() {
  await assertSafeTarget(target)
  await fs.rm(target, { recursive: true, force: true })
  await fs.mkdir(path.join(target, 'backups'), { recursive: true })
  await fs.writeFile(path.join(target, MARKER), 'Sample data generated by scripts/seed-dev-data.mjs\n')

  const random = createRandom(20260101)
  await writeJson(path.join(target, 'sections.json'), createSections())

  let written = 0
  for (let daysAgo = 0; daysAgo < DAYS; daysAgo += 1) {
    // Leave gaps so "days with data" differs from the calendar.
    if (daysAgo > 0 && daysAgo !== OUTLIER_DAY && random() < 0.22) continue
    const { year, month, day } = dateParts(daysAgo)
    await writeJson(path.join(target, year, month, `${day}.json`), createDay(daysAgo, random))
    written += 1
  }

  const notes = createNotes()
  await writeJson(path.join(target, 'notes', 'index.json'), notes.map(({ content: _content, ...meta }) => meta))
  for (const note of notes) await writeJson(path.join(target, 'notes', `${note.id}.json`), note)
  await writeJson(path.join(target, 'metadata.json'), createMetadata())

  console.log(`Seeded ${written} days, ${notes.length} notes and 4 charts into ${target}`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
