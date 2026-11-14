// Regenerates the screenshots shown in README.md (docs/screenshots/*.png).
//
//   npm run screenshots
//
// It builds the app, fills a throwaway data directory with the sample history of
// scripts/seed-dev-data.mjs plus a hand-written "today" page, starts the built app against that
// directory (never against real data: TESSERA_USER_DATA_DIR / TESSERA_DATA_DIR pin both folders),
// and saves what the window shows with the same pixels the user would see. The window runs off
// screen, so nothing appears on the desktop and nothing takes focus.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'docs', 'screenshots')

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks: marks.map(type => ({ type })) } : {}) })
const paragraph = (...content) => ({ type: 'paragraph', content })
const heading = (level, value) => ({ type: 'heading', attrs: { level }, content: [text(value)] })
const bullets = items => ({ type: 'bulletList', content: items.map(item => ({ type: 'listItem', content: [paragraph(text(item))] })) })
const tasks = items => ({
  type: 'taskList',
  content: items.map(([checked, item]) => ({ type: 'taskItem', attrs: { checked }, content: [paragraph(text(item))] }))
})
const cell = (type, value) => ({ type, content: [paragraph(text(value))] })
const row = (type, values) => ({ type: 'tableRow', content: values.map(value => cell(type, value)) })

// The page the first screenshot shows: a little of everything the editor does.
const TODAY = {
  type: 'doc',
  content: [
    heading(2, '周末小结'),
    paragraph(text('这一周'), text('比预期顺利', ['bold']), text('：周报按时交了，傍晚在江边跑了五公里，睡得也比上周早。')),
    heading(3, '本周完成'),
    tasks([[true, '写完并提交周报'], [true, '跑步 5 公里'], [true, '整理数据备份'], [false, '预约体检']]),
    heading(3, '下周想做的事'),
    bullets(['读完《长日将尽》第三部分', '试试新的跑步路线', '给老朋友写一封信']),
    {
      type: 'table',
      content: [
        row('tableHeader', ['项目', '本周', '目标']),
        row('tableCell', ['跑步（公里）', '18', '20']),
        row('tableCell', ['平均睡眠（小时）', '7.3', '7.5'])
      ]
    },
    paragraph(text('晚上读了一会儿书，十点半前关灯。', ['italic']))
  ]
}

// The long-term note the notes screenshot opens first.
const PLAN_NOTE = {
  type: 'doc',
  content: [
    heading(2, '十一月计划'),
    paragraph(text('不属于某一天的事，放在这里慢慢推进。')),
    tasks([[true, '整理数据备份'], [true, '续订体检'], [false, '读完一本书'], [false, '把相册按年份归档']]),
    heading(3, '想法池'),
    bullets(['做一个周报模板', '试试新的跑步路线', '给老朋友写一封信']),
    paragraph(text('提示：', ['bold']), text('在编辑器里输入 / 可以插入表格、标题和本地文件链接。'))
  ]
}

const SHOTS = [
  { file: 'today.png', page: '记录', config: {} },
  { file: 'timeline.png', page: '时间线', config: {} },
  { file: 'calendar.png', page: '日历', config: {} },
  { file: 'analytics.png', page: '数据分析', config: {}, wait: 1800 },
  { file: 'notes.png', page: '便签', config: {} },
  { file: 'theme-dark.png', page: '记录', config: { theme: 'dark' } },
  { file: 'theme-linen.png', page: '记录', config: { interfaceStyle: 'linen-study' } },
  { file: 'theme-jade.png', page: '记录', config: { interfaceStyle: 'jade-archive' } },
  { file: 'theme-frosted.png', page: '记录', config: { interfaceStyle: 'frosted-glass' }, wait: 1500 }
]

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'tessera-shots-'))
const userDataDir = path.join(sandbox, 'user-data')
const dataDir = path.join(sandbox, 'data')

try {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'seed-dev-data.mjs'), dataDir], { stdio: 'inherit' })
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  const todayFile = path.join(dataDir, String(now.getFullYear()), pad(now.getMonth() + 1), `${pad(now.getDate())}.json`)
  const day = JSON.parse(await fs.readFile(todayFile, 'utf8'))
  day.diary = { value: JSON.stringify(TODAY), updatedAt: now.toISOString() }
  await fs.writeFile(todayFile, JSON.stringify(day, null, 2))
  const noteFile = path.join(dataDir, 'notes', 'seed-note-1.json')
  const note = JSON.parse(await fs.readFile(noteFile, 'utf8'))
  note.title = '十一月计划'
  note.content = PLAN_NOTE
  await fs.writeFile(noteFile, JSON.stringify(note, null, 2))
  const indexFile = path.join(dataDir, 'notes', 'index.json')
  const index = JSON.parse(await fs.readFile(indexFile, 'utf8'))
  index.find(item => item.id === 'seed-note-1').title = '十一月计划'
  await fs.writeFile(indexFile, JSON.stringify(index, null, 2))
  await fs.mkdir(outDir, { recursive: true })

  const app = await electron.launch({
    args: [root],
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: '',
      TESSERA_E2E_QUIET: '1',
      TESSERA_USER_DATA_DIR: userDataDir,
      TESSERA_DATA_DIR: dataDir
    }
  })
  try {
    const window = await app.firstWindow()
    await window.waitForSelector('.sidebar')
    const captured = []
    for (const shot of SHOTS) {
      await window.evaluate(async (config) => {
        await window.api.config.set('onboardingDone', true)
        // Every shot starts from the plain defaults, so one style never leaks into the next.
        await window.api.config.set('theme', 'light')
        await window.api.config.set('interfaceStyle', 'default')
        await window.api.config.set('themeAccent', 'forest')
        for (const [key, value] of Object.entries(config)) await window.api.config.set(key, value)
      }, shot.config)
      await window.reload()
      await window.waitForSelector('.sidebar')
      await window.locator('.nav-item', { hasText: shot.page }).click()
      await window.waitForTimeout(shot.wait ?? 1000)
      if (shot.page === '便签') await window.locator('.notes-list-item').first().click()
      await window.mouse.move(0, 0)
      await window.evaluate(() => document.activeElement?.blur())
      await window.waitForTimeout(300)
      const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'))
      captured.push({ file: shot.file, png })
    }
    // PNG screenshots of a textured theme are about a megabyte each; WebP keeps the text sharp at a
    // tenth of that. Chromium (inside the app) does the encoding, so no image library is needed.
    const webp = await app.evaluate(async ({ BrowserWindow }, images) => {
      const converter = new BrowserWindow({ show: false })
      await converter.loadURL('about:blank')
      try {
        return await converter.webContents.executeJavaScript(`(async (images) => {
          const out = []
          for (const { file, png } of images) {
            const image = new Image()
            image.src = 'data:image/png;base64,' + png
            await image.decode()
            const canvas = document.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height
            canvas.getContext('2d').drawImage(image, 0, 0)
            out.push({ file, data: canvas.toDataURL('image/webp', 0.92).split(',')[1] })
          }
          return out
        })(${JSON.stringify(images)})`)
      } finally {
        converter.destroy()
      }
    }, captured)
    for (const { file, data } of webp) {
      const target = path.join(outDir, file.replace(/\.png$/, '.webp'))
      await fs.writeFile(target, Buffer.from(data, 'base64'))
      console.log(`saved ${path.relative(root, target)} (${Math.round(Buffer.byteLength(data, 'base64') / 1024)} KB)`)
    }
  } finally {
    await app.close()
  }
} finally {
  await fs.rm(sandbox, { recursive: true, force: true })
}
