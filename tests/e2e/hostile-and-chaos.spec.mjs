import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// What the unit and fuzz tests cannot show: the real app, over a data folder no one would build on
// purpose, fed hostile pastes, loaded with years of history and killed in the middle of a save.
// Set FUZZ_SEED=<number> to replay the random parts of a failure.

const EDITOR = '.sections-grid .ProseMirror'
const NAV_LABELS = ['记录', '便签', '时间线', '日历', '数据分析', '设置']
const pad = value => String(value).padStart(2, '0')
const doc = text => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] })
const char = code => String.fromCharCode(code)

const SECTIONS = [
  { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 },
  { id: 'weight', name: '体重', type: 'number', unit: 'kg', resident: false, order: 1 }
]

function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const SEED = Number(process.env.FUZZ_SEED) || 20261114

async function seedFiles(sandbox, files) {
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(sandbox.dataDir, relative)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, content)
  }
}

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

function todayFile(sandbox) {
  const now = new Date()
  return path.join(sandbox.dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(now.getDate())}.json`)
}

async function snapshot(root) {
  const found = {}
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else found[path.relative(root, full)] = await fs.readFile(full)
    }
  }
  await walk(root)
  return found
}

// ─── Extreme and damaged data ──────────────────────────────────────────────

test('every page opens over a data folder of damaged, hostile and extreme days, and changes none of it', async ({ sandbox }) => {
  const nested = (depth) => `{"type":"doc","content":[${'{"type":"blockquote","content":['.repeat(depth)}{"type":"text","text":"藏得很深"}${']}'.repeat(depth)}]}`
  const day = value => JSON.stringify({ diary: { value, updatedAt: '2025-01-01T00:00:00.000Z' } })
  const hostileText = ['<script>window.__pwned=1</script>', '<img src=x onerror="window.__pwned=1">', char(0x202e) + 'rtl', 'a' + char(0x200b) + 'b', 'nul' + char(0) + 'nul', 'lone' + char(0xd800), '👨‍👩‍👧‍👦🇨🇳', '"quotes" \\ back\\slash'].join(' ')

  await seedFiles(sandbox, {
    'sections.json': JSON.stringify(SECTIONS),
    'metadata.json': JSON.stringify({
      countdowns: [{ id: 'c-bad', title: '坏日期', date: 'not-a-date' }, { id: 'c-old', title: '很久以前', date: '0001-01-01' }],
      analytics: [
        { id: 'a1', title: '热力全部', type: 'heatmap', dateRange: 'all', bindings: [{ sectionId: 'weight', metric: 'value' }] },
        { id: 'a2', title: '连续折线', type: 'line', dateRange: 'all', dateAxisMode: 'continuous', bindings: [{ sectionId: 'weight', metric: 'value' }, { sectionId: 'diary', metric: 'wordcount' }] },
        { id: 'a3', title: '离谱范围', type: 'bar', dateRange: '99999999999999999999', bindings: [{ sectionId: 'weight', metric: 'value' }] },
        { id: 'a4', title: '饼图', type: 'pie', dateRange: 'custom', dateFrom: 'abc', dateTo: '2025-01-31', bindings: [{ sectionId: 'weight', metric: 'value' }, { sectionId: 'ghost', metric: 'value' }] }
      ]
    }),
    '2025/01/01.json': day(doc('一条正常的记录')),
    '2025/01/02.json': day(nested(2500)),
    '2025/01/03.json': '{{{ this is not json',
    '2025/01/04.json': 'null',
    '2025/01/05.json': '[1,2,3]',
    '2025/01/06.json': JSON.stringify({ diary: { value: 12345 }, weight: { value: '1e999' }, ghost: { value: '没有这个版块' } }),
    '2025/01/07.json': day(doc('日记'.repeat(250_000))),
    '2025/01/08.json': day(doc(hostileText)),
    '2025/01/09.json': JSON.stringify({ weight: { value: '70.5' } }),
    '2025/01/10.json': JSON.stringify({ weight: { value: '-1e999' }, diary: { value: '' } }),
    // Things that are not days at all, or days no calendar has.
    '2025/01/readme.txt': 'not a day',
    '2025/ab/01.json': day(doc('月份不是数字')),
    '2025/01/99.json': day(doc('第 99 天')),
    '2025/13/01.json': day(doc('第 13 个月')),
    '0001/01/01.json': day(doc('公元一年')),
    '9999/12/31.json': day(doc('遥远的未来'))
  })
  const before = await snapshot(sandbox.dataDir)

  const { app, window, problems } = await openApp(sandbox)
  try {
    for (const label of NAV_LABELS) {
      await window.locator('.nav-item', { hasText: label }).click()
      await expect(window.locator('.nav-item.active')).toContainText(label)
      await expect(window.locator('main.app-main')).toBeVisible()
      await window.waitForTimeout(400)
      // The crash page names what went wrong, which is what a failure here needs to show.
      expect(await window.locator('.error-boundary-detail').allTextContents(), `${label} page crashed`).toEqual([])
    }

    // The timeline lists the readable days, previews the deep and the huge ones, and every card opens.
    await window.locator('.nav-item', { hasText: '时间线' }).click()
    await expect(window.locator('.timeline-card').first()).toBeVisible()
    await expect(window.locator('.timeline-card', { hasText: '一条正常的记录' })).toHaveCount(1)
    await expect(window.locator('.timeline-card', { hasText: '藏得很深' })).toHaveCount(1)

    // Opening the deeply nested day works: its text is kept, and nothing is written back.
    await window.locator('.timeline-card', { hasText: '藏得很深' }).click()
    await expect(window.locator(EDITOR).first()).toContainText('藏得很深')
    await window.waitForTimeout(1500)

    // The analytics cards (all-time heatmap, absurd ranges, unknown sections) draw something.
    await window.locator('.nav-item', { hasText: '数据分析' }).click()
    await expect(window.locator('.analytics-card')).toHaveCount(4)
    await expect(window.locator('.error-boundary')).toHaveCount(0)

    expect(await window.evaluate(() => window.__pwned)).toBeUndefined()
    expect(problems.filter(problem => problem.startsWith('pageerror'))).toEqual([])
  } finally {
    await app.close()
  }

  // Looking is not editing: every file, damaged or not, is exactly as it was.
  const after = await snapshot(sandbox.dataDir)
  for (const [relative, content] of Object.entries(before)) {
    if (relative === 'metadata.json') continue
    expect(after[relative]?.equals(content), `${relative} was changed`).toBe(true)
  }
})

// ─── Hostile pastes ────────────────────────────────────────────────────────

test('a barrage of hostile pastes injects nothing, breaks nothing and still saves', async ({ sandbox }) => {
  test.setTimeout(180_000)
  const random = seeded(SEED)
  const pick = list => list[Math.floor(random() * list.length)]

  const HTML_PARTS = [
    '<script>window.__pwned=1</script>',
    '<img src=x onerror="window.__pwned=1">',
    '<a href="javascript:window.__pwned=1">脚本链接</a>',
    '<a href="JaVaScRiPt:window.__pwned=1">大小写</a>',
    '<a href="data:text/html,<script>window.__pwned=1</script>">数据链接</a>',
    '<a href="file://server/share/x.txt">网络共享</a>',
    '<a href="https://ok.example/path">正常链接</a>',
    '<a href="mailto:me@example.com">邮件</a>',
    '<iframe src="https://evil.example/"></iframe>',
    '<style>body{display:none}.ProseMirror{visibility:hidden}</style>',
    '<svg onload="window.__pwned=1"><circle r="5"/></svg>',
    '<form action="https://evil.example/"><input name=a value=b autofocus onfocus="window.__pwned=1"><button>提交</button></form>',
    '<object data="https://evil.example/x.swf"></object><embed src="https://evil.example/x.swf">',
    '<meta http-equiv="refresh" content="0;url=https://evil.example/"><base href="https://evil.example/">',
    '<p style="background:url(https://evil.example/track.png);position:fixed;top:0;left:0;width:9999px;height:9999px">遮罩</p>',
    '<table><tbody>' + '<tr><td>格</td><td>子</td></tr>'.repeat(300) + '</tbody></table>',
    '<table><tr><td><table><tr><td><table><tr><td>嵌套表格</td></tr></table></td></tr></table></td></tr></table>',
    '<div>'.repeat(1500) + '很深的 div' + '</div>'.repeat(1500),
    '<b><i><u><s>'.repeat(800) + '各种格式' + '</s></u></i></b>'.repeat(800),
    '<ul>' + '<li>项目</li>'.repeat(500) + '</ul>',
    '<p>' + '长文本'.repeat(20_000) + '</p>',
    '<h1>标题</h1><h6>小标题</h6><blockquote><blockquote>引用</blockquote></blockquote><pre><code>代码\n  缩进</code></pre>',
    '<p>' + char(0x202e) + '反向' + char(0x200b) + char(0xfeff) + char(0) + '控制字符' + char(0xd800) + '</p>',
    '<p>👨‍👩‍👧‍👦🇨🇳𠮷é</p>',
    '&lt;script&gt;window.__pwned=1&lt;/script&gt;',
    '<p contenteditable="false" data-type="taskList" onclick="window.__pwned=1">伪造属性</p>',
    '<ul data-type="taskList"><li data-checked="true" data-type="taskItem">已完成</li></ul>',
    '<!-- 注释 --><![CDATA[x]]><?php echo 1 ?>'
  ]
  const TEXT_PARTS = [
    '# 标题\n\n- [x] 完成\n- [ ] 待办\n\n| a | b |\n| - | - |\n| 1 | 2 |',
    '[点我](javascript:window.__pwned=1)',
    '[邮件](mailto:a@b.c) <https://ok.example> ![图](https://evil.example/x.png)',
    '```js\nwindow.__pwned = 1\n```',
    '*'.repeat(5000), '_'.repeat(5000), '['.repeat(3000), '>'.repeat(2000) + ' 引用', '- '.repeat(2000),
    '\n'.repeat(3000), '\t'.repeat(3000), 'x'.repeat(200_000),
    char(0x202e) + '反向' + char(0) + char(0x200b) + char(0xd800) + char(0xdc00),
    'C:\\Windows\\System32 ..\\..\\ file:///C:/Windows/win.ini \\\\server\\share'
  ]

  function payload() {
    const parts = []
    for (let count = 1 + Math.floor(random() * 3); count > 0; count -= 1) parts.push(pick(HTML_PARTS))
    const html = random() < 0.7 ? parts.join(random() < 0.5 ? '' : '\n') : ''
    return { html, text: random() < 0.8 ? pick(TEXT_PARTS) : '纯文本' }
  }

  const { app, window } = await launchApp(sandbox)
  const pageErrors = []
  const outsideRequests = []
  window.on('pageerror', error => pageErrors.push(error.message))
  window.on('request', request => {
    if (/^(https?|ftp|ws)s?:/i.test(request.url())) outsideRequests.push(request.url())
  })
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')
    const editor = window.locator(EDITOR).first()
    await editor.click()

    const CLEAN_LINK = /^(https?:|mailto:|tel:|file:\/\/\/[A-Za-z]:\/)/i
    const started = Date.now()
    for (let round = 1; round <= 36; round += 1) {
      const { html, text } = payload()
      const elapsed = await window.evaluate(({ html, text }) => {
        const begin = performance.now()
        const target = document.querySelector('.sections-grid .ProseMirror')
        const data = new DataTransfer()
        data.setData('text/plain', text)
        if (html) data.setData('text/html', html)
        target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
        return performance.now() - begin
      }, { html, text })
      // Nothing that is pasted may take the window away for long.
      expect(elapsed, `paste ${round} took ${Math.round(elapsed)} ms`).toBeLessThan(15_000)

      const verdict = await window.evaluate(() => {
        const root = document.querySelector('.sections-grid .ProseMirror')
        // The only form control the editor draws itself is the checkbox of a task item.
        const forbidden = [...root.querySelectorAll('script, iframe, style, object, embed, form, input, button, svg, base, meta, link, img, video, audio')]
          .filter(node => !(node.tagName === 'INPUT' && node.type === 'checkbox' && node.closest('[data-type="taskList"]')))
        const withHandlers = [...root.querySelectorAll('*')].filter(node => [...node.attributes].some(attribute => /^on/i.test(attribute.name)))
        const hrefs = [...root.querySelectorAll('a[href]')].map(node => node.getAttribute('href'))
        return {
          alive: Boolean(root) && root.isContentEditable,
          forbidden: forbidden.map(node => node.outerHTML.slice(0, 160)),
          withHandlers: withHandlers.length,
          hrefs,
          pwned: window.__pwned ?? null,
          pageDisplay: getComputedStyle(document.body).display,
          editorVisibility: getComputedStyle(root).visibility
        }
      })
      expect(verdict.alive, `round ${round}: the editor is gone`).toBe(true)
      expect(verdict.forbidden, `round ${round}: ${html.slice(0, 80)}`).toEqual([])
      expect(verdict.withHandlers).toBe(0)
      expect(verdict.pwned).toBeNull()
      expect(verdict.pageDisplay).not.toBe('none')
      expect(verdict.editorVisibility).not.toBe('hidden')
      for (const href of verdict.hrefs) expect(href, `round ${round}`).toMatch(CLEAN_LINK)
    }
    expect(Date.now() - started).toBeLessThan(150_000)

    // What is left saves, reads back as valid JSON, and reopens without complaint.
    await window.keyboard.press('Control+s')
    const file = todayFile(sandbox)
    await expect.poll(async () => fs.readFile(file, 'utf8').catch(() => ''), { timeout: 30_000 }).toContain('"diary"')
    const saved = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(JSON.parse(saved.diary.value).type).toBe('doc')
    await window.reload()
    await window.waitForSelector('.sidebar')
    await expect(window.locator(EDITOR).first()).toBeVisible()
    await expect(window.locator('.error-boundary')).toHaveCount(0)

    // And the editor is still an editor: clear it, write something, and it is saved.
    await window.locator(EDITOR).first().click()
    await window.keyboard.press('Control+a')
    await window.keyboard.press('Delete')
    await window.keyboard.type('after the storm')
    await window.keyboard.press('Control+s')
    await expect.poll(async () => fs.readFile(file, 'utf8').catch(() => ''), { timeout: 30_000 }).toContain('after the storm')

    expect(pageErrors).toEqual([])
    // The page's policy forbids the network, and nothing pasted gets around it.
    expect(outsideRequests).toEqual([])
  } finally {
    await app.close()
  }
})

// ─── Years of history ──────────────────────────────────────────────────────

test('three years of daily records load, search and chart within a time budget', async ({ sandbox }) => {
  test.setTimeout(180_000)
  const DAYS = 1100
  await seedFiles(sandbox, {
    'sections.json': JSON.stringify(SECTIONS),
    'metadata.json': JSON.stringify({
      countdowns: [],
      analytics: [
        { id: 'h', title: '全部热力', type: 'heatmap', dateRange: 'all', bindings: [{ sectionId: 'weight', metric: 'value' }] },
        { id: 'l', title: '全部折线', type: 'line', dateRange: 'all', dateAxisMode: 'continuous', bindings: [{ sectionId: 'weight', metric: 'value' }, { sectionId: 'diary', metric: 'wordcount' }] }
      ]
    })
  })
  const files = {}
  for (let daysAgo = 1; daysAgo <= DAYS; daysAgo += 1) {
    const date = new Date(2026, 0, 1)
    date.setDate(date.getDate() - daysAgo)
    const marker = daysAgo === 700 ? '独一无二的暗号' : '日常'
    files[`${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}.json`] = JSON.stringify({
      diary: { value: doc(`${marker} ${'这一天发生了一些事情。'.repeat(10)}`), updatedAt: '2026-01-01T00:00:00.000Z' },
      weight: { value: String(60 + (daysAgo % 17) / 2), updatedAt: '2026-01-01T00:00:00.000Z' }
    })
  }
  await seedFiles(sandbox, files)

  const started = Date.now()
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '时间线' }).click()
    await expect(window.locator('.stat-item')).toContainText(String(DAYS), { timeout: 30_000 })
    await expect(window.locator('.timeline-card').first()).toBeVisible()
    const listed = Date.now() - started
    expect(listed, `startup to the full timeline took ${listed} ms`).toBeLessThan(45_000)

    // A search reads every day, not the ones on screen.
    const searched = Date.now()
    await window.getByPlaceholder('搜索记录内容...').fill('独一无二的暗号')
    await expect(window.locator('.timeline-card')).toHaveCount(1, { timeout: 20_000 })
    expect(Date.now() - searched).toBeLessThan(20_000)
    await window.getByPlaceholder('搜索记录内容...').fill('')

    // Three years in one heatmap and one continuous line chart.
    const charted = Date.now()
    await window.locator('.nav-item', { hasText: '数据分析' }).click()
    await expect(window.locator('.analytics-card')).toHaveCount(2)
    await expect(window.locator('.analytics-card .recharts-line').first()).toBeVisible({ timeout: 30_000 })
    expect(Date.now() - charted).toBeLessThan(30_000)
    await expect(window.locator('.error-boundary')).toHaveCount(0)

    await window.locator('.nav-item', { hasText: '日历' }).click()
    await expect(window.locator('.error-boundary')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

// ─── Killing the app mid-save ──────────────────────────────────────────────

test('killing the app over and over in the middle of editing never loses what was saved or damages a file', async ({ sandbox }) => {
  test.setTimeout(240_000)
  const random = seeded(SEED + 1)
  const CYCLES = 5
  await seedFiles(sandbox, { 'sections.json': JSON.stringify(SECTIONS) })
  const file = todayFile(sandbox)

  async function assertEveryFileIsWhole(label) {
    const damaged = []
    async function walk(dir) {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== 'backups' && entry.name !== 'history') await walk(full)
        } else if (entry.name.endsWith('.json')) {
          try {
            JSON.parse(await fs.readFile(full, 'utf8'))
          } catch {
            damaged.push(path.relative(sandbox.dataDir, full))
          }
        }
      }
    }
    await walk(sandbox.dataDir)
    expect(damaged, `${label}: damaged files after the kill`).toEqual([])
  }

  for (let cycle = 0; cycle < CYCLES; cycle += 1) {
    const { app, window } = await openApp(sandbox)
    try {
      // A crash can leave a temporary file; the app asks what to do with it, and either answer is safe.
      const recover = window.getByRole('button', { name: '恢复数据' })
      if (await recover.isVisible().catch(() => false)) await recover.click()

      const editor = window.locator(EDITOR).first()
      await editor.click()
      await window.keyboard.press('Control+End')
      await window.keyboard.press('Enter')
      await window.keyboard.type(`基线${cycle}`)
      await window.keyboard.press('Control+s')
      await expect.poll(async () => fs.readFile(file, 'utf8').catch(() => ''), { timeout: 20_000 }).toContain(`基线${cycle}`)

      // Keep typing and pulling the plug at an arbitrary moment.
      await window.keyboard.press('Enter')
      const typing = window.keyboard.type('之后的内容'.repeat(400), { delay: 1 }).catch(() => {})
      await window.waitForTimeout(60 + Math.floor(random() * 1400))
      const child = app.process()
      const exited = new Promise(resolve => child.once('exit', resolve))
      child.kill('SIGKILL')
      await exited
      // The typing that was cut off fails on its own; waiting for it only burns time.
      void typing
    } finally {
      await app.close().catch(() => {})
    }
    await assertEveryFileIsWhole(`cycle ${cycle}`)
    const onDisk = await fs.readFile(file, 'utf8')
    // Everything saved before the kill is still there, in every cycle so far.
    for (let earlier = 0; earlier <= cycle; earlier += 1) expect(onDisk, `基线${earlier} after cycle ${cycle}`).toContain(`基线${earlier}`)
  }

  // One more ordinary start: the app opens, shows the text, and the files are still whole.
  const { app, window } = await openApp(sandbox)
  try {
    const recover = window.getByRole('button', { name: '恢复数据' })
    if (await recover.isVisible().catch(() => false)) await recover.click()
    await expect(window.locator(EDITOR).first()).toContainText(`基线${CYCLES - 1}`)
    await expect(window.locator('.error-boundary')).toHaveCount(0)
  } finally {
    await app.close()
  }
  await assertEveryFileIsWhole('after the last restart')
})
