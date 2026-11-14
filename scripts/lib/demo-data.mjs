// A curated sample history for demos, screenshots and videos (scripts/seed-demo-data.mjs).
//
// seed-dev-data.mjs is a test fixture: it has an extreme value on purpose and a few very long
// entries. This one aims at the opposite, a history that looks like a real person's: values that
// rise and fall with the week, no outliers, and text that does not repeat itself. Everything is
// invented; it names no real person, place or account.
//
// buildDemoData is pure (the same arguments always give the same result), so the tests can
// check it without touching the disk.

// ─── Sections ───────────────────────────────────────────────────────────────

export const DEMO_SECTIONS = Object.freeze([
  { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0, color: '#7c6aff' },
  { id: 'dev', name: 'Tessera 软件开发', type: 'text', unit: '', resident: false, order: 1, color: '#4a90e2' },
  { id: 'english', name: '英语学习', type: 'text', unit: '', resident: false, order: 2, color: '#45b58a' },
  { id: 'invest', name: '投资记录', type: 'text', unit: '', resident: false, order: 3, color: '#d9a441' },
  { id: 'sleep', name: '睡眠时长', type: 'number', unit: 'h', resident: false, order: 4, color: '#e184a8', numberDefaultMode: 'manual' },
  { id: 'exercise', name: '运动时长', type: 'number', unit: 'min', resident: false, order: 5, color: '#e8803a', numberDefaultMode: 'manual' },
  { id: 'spending', name: '生活开支', type: 'number', unit: '元', resident: false, order: 6, color: '#5b8cff', numberDefaultMode: 'manual' },
  { id: 'weight', name: '体重', type: 'number', unit: 'kg', resident: false, order: 7, color: '#2fb5a8', numberDefaultMode: 'carry' },
  { id: 'mood', name: '心情打分', type: 'number', unit: '分', resident: false, order: 8, color: '#d9b24c', numberDefaultMode: 'manual' }
])

// What each number section holds, for the tests and for whoever reads the data.
export const DEMO_NUMBER_RANGES = Object.freeze({
  sleep: { min: 4.8, max: 9.4, decimals: 1 },
  exercise: { min: 15, max: 90, decimals: 0 },
  spending: { min: 12, max: 260, decimals: 0 },
  weight: { min: 69, max: 74, decimals: 1 },
  mood: { min: 2, max: 10, decimals: 0 }
})

// ─── Random numbers ─────────────────────────────────────────────────────────

// mulberry32: tiny, seeded, and good enough to look random.
export function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const gauss = random => {
  const u = Math.max(random(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const pick = (random, list) => list[Math.floor(random() * list.length)]
const chance = (random, probability) => random() < probability
const round = (value, decimals) => Number(value.toFixed(decimals))

// ─── Document building blocks ───────────────────────────────────────────────

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks: marks.map(type => ({ type })) } : {}) })
const paragraph = (...parts) => ({
  type: 'paragraph',
  content: parts.map(part => (typeof part === 'string' ? text(part) : part))
})
const heading = (level, value) => ({ type: 'heading', attrs: { level }, content: [text(value)] })
const bulletList = items => ({
  type: 'bulletList',
  content: items.map(item => ({ type: 'listItem', content: [paragraph(item)] }))
})
const taskList = items => ({
  type: 'taskList',
  content: items.map(([checked, item]) => ({ type: 'taskItem', attrs: { checked }, content: [paragraph(item)] }))
})
const blockquote = value => ({ type: 'blockquote', content: [paragraph(value)] })
const codeBlock = source => ({ type: 'codeBlock', attrs: { language: null }, content: [text(source)] })
const tableCell = (type, value) => ({ type, content: [paragraph(value)] })
const table = (header, rows) => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: header.map(value => tableCell('tableHeader', value)) },
    ...rows.map(row => ({ type: 'tableRow', content: row.map(value => tableCell('tableCell', value)) }))
  ]
})
const doc = (...content) => ({ type: 'doc', content })

// ─── Text banks ─────────────────────────────────────────────────────────────

const DIARY_OPENERS = [
  '今天下了一整天的雨，窗外灰蒙蒙的，反而很适合待在家里。',
  '天气很好，中午在楼下的小公园晒了会儿太阳。',
  '风有点大，出门时差点把伞吹翻。',
  '早上起了薄雾，路上的人都慢悠悠的。',
  '闷了好几天，傍晚终于下起了雨，空气清新了不少。',
  '醒得比闹钟早，躺着发了会儿呆才起床。',
  '上午把拖了几天的事情一口气处理掉了，感觉轻松很多。',
  '开了一个很长的会，下午只剩一点零碎的时间。',
  '今天效率不错，三件事都按计划做完了。',
  '下午注意力总是飘，换了个地方坐着才慢慢进入状态。',
  '把桌面和文件夹整理了一遍，找东西不再费劲。',
  '早上喝了杯咖啡，一直忙到过了饭点才想起吃饭。'
]
const DIARY_MIDDLES = [
  '中午自己做了番茄鸡蛋面，味道比想象中好。',
  '晚饭煮了一锅粥，配了点小菜，简单但很舒服。',
  '今天点了外卖，下次还是想自己做饭。',
  '试着做了一次红烧排骨，咸了一点，下次少放酱油。',
  '晚上和朋友吃了火锅，聊到很晚才回家。',
  '和朋友通了电话，聊了最近各自的状态。',
  '同事分享了一个很实用的小技巧，赶紧记了下来。',
  '家里人发来几张照片，看着心里暖暖的。',
  '朋友约周末去爬山，我答应了。',
  '去超市买了一周的菜，顺手带回一盆小绿植。',
  '路过一家新开的面包店，买了个可颂，还不错。'
]
const DIARY_ENDINGS = [
  '睡前读了二十几页书，读着读着就困了。',
  '明天想早点起，把计划表再过一遍。',
  '给自己泡了杯茶，今天就到这里。',
  '把明天要做的三件事写在了便签上。',
  '洗完澡听了一会儿歌，心情慢慢平静下来。',
  '收拾完厨房，关灯前又看了一眼窗外的夜色。'
]
const DIARY_AFTER_EXERCISE = [
  minutes => `今天运动了 ${minutes} 分钟，出了一身汗，状态不错。`,
  minutes => `跑步的时候听了一集播客，${minutes} 分钟不知不觉就过去了。`,
  minutes => `傍晚出去活动了 ${minutes} 分钟，回来整个人都松快了。`
]
const DIARY_BAD_SLEEP = [
  '昨晚没睡好，白天有点犯困，打算今晚早点休息。',
  '熬夜之后整个人都慢半拍，下次不能这样了。'
]
const DIARY_GOOD_SLEEP = ['昨晚睡得很踏实，早上起来精神很好。', '睡够了的一天，做什么都顺手一些。']
const DIARY_HIGH_MOOD = ['今天心情不错，莫名觉得一切都挺顺利的。', '没有什么特别的事，但心里很轻快。']
const DIARY_LOW_MOOD = ['有点低落，没做太多，允许自己慢一点。', '情绪不太高，早点休息，明天再说。']

// One entry per day of the trip, in order.
const DIARY_TRIP = [
  ['出发的日子。坐了很久的车，到的时候天已经黑了，先找地方吃了碗热腾腾的面。', '把行李放好，早早洗漱，明天想去看看当地的老街。'],
  ['早上沿着河边走了很久，空气很好。下午在一家小咖啡馆坐了半天，什么都没想。', '晚上在街边买了点小吃，边走边吃，很自在。'],
  ['今天去爬了山，上山的时候累得说不出话，到山顶的那一刻觉得值了。', '回来的路上腿有点软，晚上睡得应该会很香。'],
  ['最后一天，慢慢收拾东西，给家里带了一点特产。', '回程的路上翻了翻这几天拍的照片，有点舍不得，但也想念自己的书桌了。']
]

const DEV_TOPICS = [
  ['时间线', ['搜索结果里的关键词高亮错位，原来是按字节而不是按字符算的偏移', '加了按版块筛选，交互比想象中顺手']],
  ['备份与恢复', ['导出 ZIP 时校验文件数量，避免漏掉子目录', '恢复之前先做一份快照，失败可以回滚']],
  ['编辑器', ['粘贴 Markdown 时保持表格结构，补了几个边界用例', '斜杠菜单增加了表格，Tab 键可以在单元格之间移动']],
  ['日历', ['周视图跨月显示有问题，修好了', '倒数日支持自定义颜色']],
  ['数据分析', ['热力图的色阶改成按排名混合，一个极端值不再把其他日子压成一片', '饼图的图例太挤，换成了两列']],
  ['性能', ['打开三年的数据时首屏有点慢，改成分批加载', '用性能面板看了一遍，瓶颈在重复解析 JSON']],
  ['界面风格', ['雾化玻璃在深色壁纸下对比度不够，微调了模糊度', '亚麻书房的纸张纹理换了一张更干净的']],
  ['测试', ['给保存流程补了断电模拟的测试', '端到端测试里加了一个反复强制结束程序的用例']],
  ['打包发布', ['整理了安装包体积，去掉了用不到的语言包', '写好了发布说明的草稿']],
  ['使用说明', ['把快捷键表重写了一遍', '补了常见问题：数据放在哪里、怎么备份']],
  ['便签', ['便签可以关联到一段日期，抽屉里能直接翻看', '归档的便签不再出现在默认列表里']],
  ['设置页', ['版块可以拖动排序，动画再顺一点就好了', '数字版块增加了「延续前一日数据」的选项']],
  ['键盘操作', ['补齐了对话框里的 Tab 顺序', '快捷键清单里加了沉浸写作']]
]
const DEV_NEXT = [
  '明天：跑一遍完整的测试',
  '明天：把今天的改动整理成提交',
  '明天：在隔离的数据目录里实际用一用',
  '这周：再检查一遍边界情况'
]
const DEV_SNIPPETS = [
  'function weekStart(date) {\n  const copy = new Date(date)\n  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7))\n  return copy\n}',
  'const recent = days\n  .filter(day => day.value !== \'\')\n  .slice(-30)\n  .map(day => Number(day.value))',
  'await fs.writeFile(`${file}.tmp`, content)\nawait fs.rename(`${file}.tmp`, file)'
]

const ENGLISH_WORDS = [
  ['resilient', '有韧性的', 'She stayed resilient after the setback.'],
  ['meticulous', '一丝不苟的', 'He keeps meticulous notes of every experiment.'],
  ['ambiguous', '含糊不清的', 'The instructions were ambiguous, so I asked again.'],
  ['reluctant', '不情愿的', 'I was reluctant to change the plan at the last minute.'],
  ['thrive', '茁壮成长', 'Small habits thrive when they are easy to keep.'],
  ['consistent', '始终如一的', 'Consistent practice matters more than long sessions.'],
  ['inevitable', '不可避免的', 'Some delay is inevitable on a long project.'],
  ['perspective', '视角', 'Writing things down gives me a calmer perspective.'],
  ['deliberate', '刻意的', 'Deliberate practice is slow but effective.'],
  ['overwhelm', '使不堪重负', 'Too many open tabs can overwhelm me.'],
  ['negotiate', '协商', 'We negotiated a more realistic deadline.'],
  ['fragile', '脆弱的', 'Trust is fragile and takes time to rebuild.'],
  ['gradual', '逐渐的', 'Progress is gradual, but it adds up.'],
  ['hesitate', '犹豫', 'Do not hesitate to ask for help.'],
  ['maintain', '维持', 'It is harder to maintain a habit than to start one.'],
  ['obstacle', '障碍', 'Every obstacle taught me something useful.'],
  ['sustain', '支撑', 'Rest helps me sustain my energy.'],
  ['vivid', '生动的', 'I have a vivid memory of that morning walk.'],
  ['accurate', '准确的', 'Please make sure the numbers are accurate.'],
  ['sufficient', '足够的', 'Seven hours of sleep is sufficient for me.'],
  ['tentative', '暂定的', 'The schedule is tentative until Friday.'],
  ['elaborate', '详细说明', 'Could you elaborate on that point?']
]
const ENGLISH_LISTENING = [
  '精听了一段 3 分钟的访谈，听写正确率大约 85%。',
  '泛听了一集讲习惯养成的播客，记下了三个好用的表达。',
  '跟读了十分钟，注意连读和重音。',
  '今天听力有点吃力，语速太快，明天换一段慢一点的。',
  '复习了上周的错词，错的大多是同音词。'
]
const ENGLISH_JOURNAL = [
  'Today I walked to the park and felt much calmer.',
  'I finished my tasks early, so I had time to read.',
  'It rained all day, but I enjoyed the quiet.',
  'I tried a new recipe; it was a little too salty.',
  'I should go to bed earlier tomorrow.',
  'My focus was poor this afternoon, so I took a short walk.'
]

const INVEST_LINES = [
  '定投日：按计划买入指数基金 1000 元，不看短期涨跌。',
  '看了一下持仓比例，股票类、债券类和现金大致是 6 : 3 : 1，暂时不需要调整。',
  '读了一篇关于长期投资的文章，记下一句：先别亏钱，再谈赚钱。',
  '市场波动比较大，提醒自己不追涨、不杀跌，保持节奏。',
  '把本月的收支和投资记录核对了一遍，数字对得上。',
  '应急备用金还够用，不打算动它。'
]
const INVEST_TABLE = table(['类别', '占比', '备注'], [
  ['股票类基金', '58%', '每月定投'],
  ['债券类基金', '31%', '长期持有'],
  ['现金', '11%', '应急备用']
])

// ─── Dates ──────────────────────────────────────────────────────────────────

const pad = value => String(value).padStart(2, '0')

function dayInfo(today, daysAgo) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, 12, 0, 0, 0)
  return {
    year: String(date.getFullYear()),
    month: pad(date.getMonth() + 1),
    day: pad(date.getDate()),
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    weekday: date.getDay(),
    dayOfMonth: date.getDate(),
    stamp: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 21, 30, 0, 0).toISOString()
  }
}

const isWeekend = weekday => weekday === 0 || weekday === 6

// ─── Numbers ────────────────────────────────────────────────────────────────

// A short trip: a few days with only a diary and some holiday spending.
const TRIP_START = 98
const TRIP_END = 95
const isTripDay = daysAgo => daysAgo <= TRIP_START && daysAgo >= TRIP_END

const EXERCISE_CHANCE_BY_WEEKDAY = [0.5, 0.35, 0.55, 0.35, 0.55, 0.4, 0.7]
const EXERCISE_MINUTES = [20, 25, 30, 30, 35, 40, 45, 45, 50, 60, 60, 75, 90]

// The numbers of every day, oldest first, because mood follows sleep and weight drifts slowly.
function buildNumbers({ days, today, random }) {
  const records = new Map()
  let energy = 0
  let restDays = 0
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo -= 1) {
    const info = dayInfo(today, daysAgo)
    const weekend = isWeekend(info.weekday)
    const trip = isTripDay(daysAgo)
    const progress = (days - 1 - daysAgo) / Math.max(1, days - 1)
    energy = 0.7 * energy + 0.45 * gauss(random)

    const record = {}
    // Sleep and mood are noted together each evening, so a chart of both never has one without the other.
    if (chance(random, 0.92)) {
      const sleep = 7.2 + (weekend ? 0.6 : 0) + 0.65 * gauss(random)
      record.sleep = round(clamp(sleep, 4.8, 9.4), 1)
      const mood = 6.3 + 0.55 * (record.sleep - 7.2) + 0.9 * energy + (weekend ? 0.3 : 0) + (trip ? 1.4 : 0) + 0.8 * gauss(random)
      record.mood = Math.round(clamp(mood, 2, 10))
    }
    if (!trip) {
      let exerciseChance = EXERCISE_CHANCE_BY_WEEKDAY[info.weekday]
      if (record.sleep && record.sleep < 5.8) exerciseChance *= 0.5
      // Nobody rests for ten days in a row: after three quiet days the next one is almost sure to be active.
      if (restDays >= 3) exerciseChance = 0.9
      if (chance(random, exerciseChance)) {
        // The sessions get a little longer as the months go by.
        const stretch = 1 + 0.15 * progress
        record.exercise = clamp(Math.round(pick(random, EXERCISE_MINUTES) * stretch / 5) * 5, 15, 90)
        restDays = 0
      } else {
        restDays += 1
      }
      if (chance(random, 0.6)) {
        const trend = 73 - 2.5 * progress
        const wave = 0.3 * Math.sin(daysAgo / 9) + (weekend ? 0.25 : 0)
        record.weight = round(clamp(trend + wave + 0.18 * gauss(random), 69, 74), 1)
      }
    }
    if (chance(random, 0.85)) {
      let spending
      if (trip) spending = 140 + random() * 110
      else if (chance(random, 0.03)) spending = 170 + random() * 90
      else spending = (weekend ? 95 : 55) * Math.exp((weekend ? 0.35 : 0.38) * gauss(random))
      record.spending = Math.round(clamp(spending, 12, 260))
    }
    records.set(daysAgo, record)
  }
  return records
}

// ─── Documents ──────────────────────────────────────────────────────────────

function buildDiary({ random, numbers, review, tripDay }) {
  if (tripDay !== null) return doc(...DIARY_TRIP[tripDay].map(line => paragraph(line)))
  const blocks = []
  blocks.push(paragraph(pick(random, DIARY_OPENERS)))
  const middle = [pick(random, DIARY_MIDDLES)]
  if (numbers.exercise) middle.push(pick(random, DIARY_AFTER_EXERCISE)(numbers.exercise))
  blocks.push(paragraph(...middle))

  const feeling = []
  if (numbers.sleep && numbers.sleep < 6.2) feeling.push(pick(random, DIARY_BAD_SLEEP))
  else if (numbers.sleep && numbers.sleep > 8.2) feeling.push(pick(random, DIARY_GOOD_SLEEP))
  if (numbers.mood && numbers.mood >= 8) feeling.push(pick(random, DIARY_HIGH_MOOD))
  else if (numbers.mood && numbers.mood <= 4) feeling.push(pick(random, DIARY_LOW_MOOD))
  if (feeling.length) blocks.push(paragraph(...feeling))
  if (chance(random, 0.45)) blocks.push(paragraph(pick(random, DIARY_ENDINGS)))

  if (review) {
    blocks.push(heading(3, '本周回顾'))
    blocks.push(bulletList(review.bullets))
    blocks.push(taskList(review.tasks))
  }
  return doc(...blocks)
}

function buildDev(random) {
  const [topic, notes] = pick(random, DEV_TOPICS)
  const blocks = [paragraph(text(topic, ['bold']), '：今天主要做了这些')]
  blocks.push(bulletList(notes))
  if (chance(random, 0.25)) blocks.push(codeBlock(pick(random, DEV_SNIPPETS)))
  if (chance(random, 0.5)) blocks.push(taskList([[true, '提交并推送'], [false, pick(random, DEV_NEXT)]]))
  return doc(...blocks)
}

function pickWords(random, count) {
  const chosen = new Set()
  while (chosen.size < count) chosen.add(Math.floor(random() * ENGLISH_WORDS.length))
  return [...chosen].map(index => ENGLISH_WORDS[index])
}

function buildEnglish(random) {
  const kind = random()
  if (kind < 0.4) {
    return doc(
      heading(3, '今日词汇'),
      table(['单词', '释义', '例句'], pickWords(random, 3)),
      paragraph(pick(random, ENGLISH_LISTENING))
    )
  }
  if (kind < 0.75) {
    return doc(
      paragraph(pick(random, ENGLISH_LISTENING)),
      blockquote(pick(random, ENGLISH_JOURNAL)),
      paragraph('试着用英语写了一句今天的小结。')
    )
  }
  return doc(
    taskList([[true, '背 10 个单词'], [true, '听力 30 分钟'], [chance(random, 0.5), '写一小段英文']]),
    paragraph(pick(random, ENGLISH_LISTENING))
  )
}

function buildInvest(random, scheduled) {
  const first = scheduled ? INVEST_LINES[0] : pick(random, INVEST_LINES.slice(1))
  const blocks = [paragraph(first)]
  if (chance(random, 0.35)) blocks.push(INVEST_TABLE)
  else if (chance(random, 0.5)) blocks.push(paragraph(pick(random, INVEST_LINES.slice(1))))
  if (scheduled) blocks.push(taskList([[true, '检查定投扣款'], [false, '月底做一次复盘']]))
  return doc(...blocks)
}

function weeklyReview(daysAgo, records) {
  const week = []
  for (let offset = 0; offset < 7; offset += 1) week.push(records.get(daysAgo + offset) || {})
  const sleeps = week.map(record => record.sleep).filter(Boolean)
  const spends = week.map(record => record.spending).filter(Boolean)
  const workouts = week.filter(record => record.exercise).length
  const average = list => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0)
  return {
    bullets: [
      `运动 ${workouts} 次`,
      `平均睡眠 ${average(sleeps).toFixed(1)} 小时`,
      `日均开支约 ${Math.round(average(spends))} 元`
    ],
    tasks: [[true, '整理房间'], [workouts >= 3, '每周运动三次以上'], [false, '预约体检']]
  }
}

// ─── Everything else ────────────────────────────────────────────────────────

function buildNotes(now, today) {
  const stamp = now.toISOString()
  const weekAgo = dayInfo(today, 7).iso
  const todayIso = dayInfo(today, 0).iso
  const make = (id, title, content, extra = {}) => ({
    id, title, content, createdAt: stamp, updatedAt: stamp, pinned: false, archived: false, fontSize: 14, dateLink: null, ...extra
  })
  return [
    make('demo-note-1', '本月目标', doc(taskList([
      [true, '整理一次数据备份'], [true, '每天英语听力 30 分钟'], [false, '每周运动三次以上'], [false, '完成 Tessera 的发布准备']
    ])), { pinned: true }),
    make('demo-note-2', '灵感池', doc(bulletList(['做一个周回顾模板', '试试新的跑步路线', '把常用英语表达整理成表格', '周末去郊外走走']))),
    make('demo-note-3', '本周关注', doc(paragraph('本周重点：睡眠、英语听力，周末去爬山。')), {
      dateLink: { type: 'range', start: weekAgo, end: todayIso }
    }),
    make('demo-note-4', '想读的书', doc(bulletList(['一本讲习惯养成的', '一本讲写作的', '一本投资入门的']))),
    make('demo-note-5', '旧想法', doc(paragraph('已经做完的计划，先放在这里。')), { archived: true })
  ]
}

function buildMetadata({ today, favorites }) {
  const future = daysAhead => dayInfo(today, -daysAhead).iso
  return {
    countdowns: [
      { id: 1, name: '项目演示日', date: future(21), color: '#60a5fa' },
      { id: 2, name: '英语考试', date: future(38), color: '#f87171' },
      { id: 3, name: '旅行出发', date: future(62), color: '#34d399' }
    ],
    analytics: [
      {
        id: 'demo-chart-1', title: '睡眠与心情', type: 'line', dateRange: '30', dateAxisMode: 'recorded',
        lineStyle: 'smooth', dateFrom: '', dateTo: '',
        bindings: [{ sectionId: 'sleep', metric: 'value' }, { sectionId: 'mood', metric: 'value' }]
      },
      {
        id: 'demo-chart-2', title: '写作活跃度', type: 'heatmap', dateRange: '365', dateAxisMode: 'recorded',
        lineStyle: 'smooth', dateFrom: '', dateTo: '', bindings: [{ sectionId: 'diary', metric: 'wordcount' }]
      },
      {
        id: 'demo-chart-3', title: '每天的运动时长', type: 'bar', dateRange: '30', dateAxisMode: 'continuous',
        lineStyle: 'smooth', dateFrom: '', dateTo: '', bindings: [{ sectionId: 'exercise', metric: 'value' }]
      },
      {
        id: 'demo-chart-4', title: '各版块的文字量', type: 'pie', dateRange: '90', dateAxisMode: 'recorded',
        lineStyle: 'smooth', dateFrom: '', dateTo: '',
        bindings: ['diary', 'dev', 'english', 'invest'].map(sectionId => ({ sectionId, metric: 'wordcount' }))
      },
      {
        id: 'demo-chart-5', title: '生活开支', type: 'bar', dateRange: '30', dateAxisMode: 'continuous',
        lineStyle: 'smooth', dateFrom: '', dateTo: '', bindings: [{ sectionId: 'spending', metric: 'value' }]
      },
      {
        id: 'demo-chart-6', title: '运动热力图', type: 'heatmap', dateRange: '365', dateAxisMode: 'recorded',
        lineStyle: 'smooth', dateFrom: '', dateTo: '', bindings: [{ sectionId: 'exercise', metric: 'value' }]
      }
    ],
    favorites
  }
}

/**
 * The whole sample history: { sections, days: [{ year, month, day, iso, entries }], notes, metadata }.
 *
 * `days` is how many days back the history reaches. Today itself is left empty unless
 * `withToday` is set, so a recording can start by typing into a blank page.
 */
export function buildDemoData({ days = 210, today = new Date(), withToday = false, seed = 20261114 } = {}) {
  const random = createRandom(seed)
  const records = buildNumbers({ days, today, random })
  const result = []
  const favorites = []

  for (let daysAgo = days - 1; daysAgo >= (withToday ? 0 : 1); daysAgo -= 1) {
    const info = dayInfo(today, daysAgo)
    const numbers = records.get(daysAgo)
    const trip = isTripDay(daysAgo)
    // The empty days a real history has: nothing was written down at all.
    if (!trip && chance(random, 0.05)) continue

    const entry = value => ({ value, updatedAt: info.stamp })
    const entries = {}
    const review = info.weekday === 0 && daysAgo + 6 < days ? weeklyReview(daysAgo, records) : null
    if (review || trip || chance(random, 0.86)) entries.diary = entry(JSON.stringify(buildDiary({ random, numbers, review, tripDay: trip ? TRIP_START - daysAgo : null })))
    if (!trip && chance(random, isWeekend(info.weekday) ? 0.3 : 0.6)) entries.dev = entry(JSON.stringify(buildDev(random)))
    if (!trip && chance(random, 0.55)) entries.english = entry(JSON.stringify(buildEnglish(random)))
    const scheduled = info.dayOfMonth === 1 || info.dayOfMonth === 15
    if (!trip && (scheduled || chance(random, 0.1))) entries.invest = entry(JSON.stringify(buildInvest(random, scheduled)))
    for (const [id, value] of Object.entries(numbers)) entries[id] = entry(String(value))

    if (Object.keys(entries).length === 0) continue
    if (review && entries.diary) favorites.push({ date: info.iso, sectionId: 'diary', addedAt: info.stamp })
    result.push({ year: info.year, month: info.month, day: info.day, iso: info.iso, entries })
  }

  // Keep a handful of favourites: a few weekly reviews, spread over the history.
  const kept = favorites.filter((_, index) => index % 6 === 0).slice(0, 4)
  return {
    sections: DEMO_SECTIONS.map(section => ({ ...section })),
    days: result,
    notes: buildNotes(new Date(today), today),
    metadata: buildMetadata({ today, favorites: kept })
  }
}
