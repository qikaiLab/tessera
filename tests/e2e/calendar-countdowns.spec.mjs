import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// The countdown days: a drawer beside the calendar where nothing waits for a "save", markers on the
// days in every view, and a strip of the nearest ones under the calendar.

async function openCalendar(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  await launched.window.locator('.nav-item', { hasText: '日历' }).click()
  await expect(launched.window.locator('.cal-slide')).toBeVisible()
  return launched
}

async function savedCountdowns(sandbox) {
  try {
    const meta = JSON.parse(await fs.readFile(path.join(sandbox.dataDir, 'metadata.json'), 'utf8'))
    return meta.countdowns || []
  } catch {
    return []
  }
}

async function seedCountdowns(sandbox, countdowns) {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'metadata.json'), JSON.stringify({ countdowns }))
}

const pad = value => String(value).padStart(2, '0')
const formatDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function isoDate(daysFromToday) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return formatDate(date)
}

const openDrawer = async (window) => {
  await window.locator('.cd-strip-manage').click()
  const drawer = window.locator('aside.cd-drawer')
  await expect(drawer).toBeVisible()
  return drawer
}

test('a countdown is added with one click on 添加 and is already saved', async ({ sandbox }) => {
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    // The way in is under the calendar, and only there: the page header has no countdown button.
    await expect(window.locator('.page-header').getByRole('button', { name: /倒数日/ })).toHaveCount(0)
    await expect(window.locator('.cd-strip')).toContainText('还没有倒数日')
    await expect(window.locator('.cd-strip-manage')).toHaveText('添加倒数日')

    const drawer = await openDrawer(window)
    // With nothing there yet the form is already open, on its first field.
    await expect(drawer.getByLabel('名称')).toBeFocused()
    await expect(drawer).toContainText('还没有倒数日')

    // 添加 insists on a name and a date, and says which is missing.
    await drawer.getByRole('button', { name: '添加', exact: true }).click()
    await expect(drawer.getByRole('alert')).toHaveText(['请填写倒数日名称', '请选择日期'])
    await drawer.getByLabel('名称').fill('考试')
    await drawer.getByRole('button', { name: '添加', exact: true }).click()
    await expect(drawer.getByRole('alert')).toHaveText(['请选择日期'])

    await drawer.locator('input[type="date"]').fill(isoDate(10))
    await drawer.getByRole('button', { name: '添加', exact: true }).click()

    // That one click was all: it is in the list, the form has closed, and it is on disk.
    const row = drawer.locator('.cd-item', { hasText: '考试' })
    await expect(row).toHaveCount(1)
    await expect(row.locator('.cd-days')).toHaveAttribute('title', '还有 10 天')
    await expect(drawer.getByRole('button', { name: '＋ 新建倒数日' })).toBeVisible()
    await expect.poll(async () => (await savedCountdowns(sandbox)).map(item => [item.name, item.date])).toEqual([['考试', isoDate(10)]])

    // Closed, the nearest countdowns sit under the calendar.
    await drawer.getByRole('button', { name: '关闭倒数日' }).click()
    await expect(drawer).toHaveCount(0)
    const strip = window.locator('.cd-strip')
    await expect(strip.locator('.cd-chip')).toHaveCount(1)
    await expect(strip).toContainText('考试')
    await expect(strip).toContainText('还有 10 天')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('an existing countdown is edited in place, every valid change is saved, and a wrong one never is', async ({ sandbox }) => {
  await seedCountdowns(sandbox, [{ id: 1, name: '旅行', date: isoDate(30), color: '#34d399', extra: 'kept' }])
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    const drawer = await openDrawer(window)
    await drawer.locator('.cd-row').first().click()
    const editor = drawer.locator('.cd-edit')
    await expect(editor).toBeVisible()

    await editor.getByLabel('名称').fill('长途旅行')
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.name).toBe('长途旅行')
    await expect(editor).toContainText('修改已自动保存')

    await editor.locator('input[type="date"]').fill(isoDate(45))
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.date).toBe(isoDate(45))

    await editor.getByRole('button', { name: '颜色 #f87171' }).click()
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.color).toBe('#f87171')

    await editor.getByLabel('备注（可选）').fill('提前订票')
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.note).toBe('提前订票')

    // An empty name is not stored: the old one stays on disk, and leaving the field puts it back.
    await editor.getByLabel('名称').fill('')
    await expect(editor.getByRole('alert')).toHaveText('请填写倒数日名称')
    await window.waitForTimeout(500)
    expect((await savedCountdowns(sandbox))[0].name).toBe('长途旅行')
    await editor.getByLabel('名称').blur()
    await expect(editor.getByLabel('名称')).toHaveValue('长途旅行')

    // What the file held that the page does not know about is still there.
    expect((await savedCountdowns(sandbox))[0]).toMatchObject({ id: 1, extra: 'kept', name: '长途旅行', color: '#f87171' })
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a countdown can repeat every N weeks, months or years, and falls on each of those days', async ({ sandbox }) => {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const base = new Date(monthStart)
  base.setDate(base.getDate() - 19)
  await seedCountdowns(sandbox, [{ id: 1, name: '周会', date: formatDate(base), color: '#34d399' }])
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    const drawer = await openDrawer(window)
    await drawer.locator('.cd-row').first().click()
    const editor = drawer.locator('.cd-edit')

    await editor.getByRole('radio', { name: '每周' }).click()
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.repeat).toEqual({ unit: 'week', every: 1 })
    await expect(drawer.locator('.cd-rep')).toHaveText('↻ 每周')

    await editor.getByLabel('重复间隔').fill('2')
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.repeat).toEqual({ unit: 'week', every: 2 })
    await expect(drawer.locator('.cd-rep')).toHaveText('↻ 每 2 周')
    // A step that is not a number is not stored.
    await editor.getByLabel('重复间隔').fill('')
    await expect(editor.getByRole('alert')).toBeVisible()
    await window.waitForTimeout(400)
    expect((await savedCountdowns(sandbox))[0].repeat).toEqual({ unit: 'week', every: 2 })
    await editor.getByLabel('重复间隔').fill('2')

    await drawer.getByRole('button', { name: '关闭倒数日' }).click()
    await expect(drawer).toHaveCount(0)

    // Every second week from the first date, in this month's grid.
    const dayMs = 86_400_000
    const expected = []
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= days; day += 1) {
      const diff = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), day) - Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / dayMs)
      if (diff >= 0 && diff % 14 === 0) expected.push(String(day))
    }
    const marked = window.locator('.month-grid .cal-day:not(.other-month):has(.cal-countdown-tag) .cal-day-num')
    await expect(marked).toHaveText(expected)

    // Yearly with the date far in the past still comes round: the birthday marks its day this year.
    await window.locator('.cd-strip-manage').click()
    await drawer.locator('.cd-row').first().click()
    await drawer.locator('.cd-edit input[type="date"]').fill(`2000-${pad(today.getMonth() + 1)}-15`)
    await drawer.locator('.cd-edit').getByRole('radio', { name: '每年' }).click()
    await drawer.locator('.cd-edit').getByLabel('重复间隔').fill('1')
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.repeat).toEqual({ unit: 'year', every: 1 })
    await drawer.getByRole('button', { name: '关闭倒数日' }).click()
    await expect(window.locator('.month-grid .cal-day:not(.other-month):has(.cal-countdown-tag) .cal-day-num')).toHaveText(['15'])
    expect((await savedCountdowns(sandbox))[0].repeat).toEqual({ unit: 'year', every: 1 })
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('several countdowns on one day are all shown, in the month, the week and the year', async ({ sandbox }) => {
  await seedCountdowns(sandbox, [
    { id: 1, name: '期末考试', date: isoDate(0), color: '#f87171' },
    { id: 2, name: '交作业', date: isoDate(0), color: '#60a5fa' },
    { id: 3, name: '生日', date: isoDate(0), color: '#f472b6' }
  ])
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    // Month: one short bar per countdown, and a title that names them all.
    const monthToday = window.locator('.month-grid .cal-day.today')
    await expect(monthToday.locator('.cal-bars i')).toHaveCount(3)
    await expect(monthToday.locator('.cal-bars')).toHaveAttribute('title', /期末考试[\s\S]*交作业[\s\S]*生日/)

    // Week: every one is listed, today says so, and its card has an even border (no thick left edge).
    await window.getByRole('button', { name: '周视图' }).click()
    const weekToday = window.locator('.week-day.today')
    await expect(weekToday.locator('.cal-countdown-tag')).toHaveText(['期末考试', '交作业', '生日'])
    await expect(weekToday.locator('.cal-today-pill')).toHaveText('今天')
    const borders = await weekToday.evaluate(el => {
      const style = getComputedStyle(el)
      return [style.borderTopWidth, style.borderLeftWidth, style.borderRightWidth, style.borderBottomWidth]
    })
    expect(new Set(borders).size).toBe(1)

    // Year: a dot under the number, not a bar along the bottom of the cell.
    await window.getByRole('button', { name: '年视图' }).click()
    const yearToday = window.locator('.year-day.today.has-countdown').first()
    await expect(yearToday).toBeVisible()
    const look = await yearToday.evaluate(el => ({ shadow: getComputedStyle(el).boxShadow, dot: getComputedStyle(el, '::after').width }))
    expect(look.shadow).toBe('none')
    expect(look.dot).toBe('4px')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('right-clicking a day offers its record, a new countdown on that day, and editing the ones it has', async ({ sandbox }) => {
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    const now = new Date()
    const target = now.getDate() === 15 ? 16 : 15
    const dateText = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(target)}`
    const cell = () => window.locator('.month-grid .cal-day:not(.other-month)').nth(target - 1)

    await cell().click({ button: 'right' })
    const menu = window.locator('.app-context-menu')
    await expect(menu.getByRole('menuitem')).toHaveText(['打开这一天的记录', '在这一天添加倒数日'])
    await menu.getByRole('menuitem', { name: '在这一天添加倒数日' }).click()

    // The drawer opens on a new countdown that already has that day.
    const drawer = window.locator('aside.cd-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.locator('input[type="date"]')).toHaveValue(dateText)
    await expect(drawer.getByLabel('名称')).toBeFocused()
    await drawer.getByLabel('名称').fill('聚餐')
    await drawer.getByRole('button', { name: '添加', exact: true }).click()
    await expect.poll(async () => (await savedCountdowns(sandbox)).map(item => [item.name, item.date])).toEqual([['聚餐', dateText]])
    await expect(cell().locator('.cal-countdown-tag')).toHaveText('聚餐')

    // The same day now offers to edit it, which opens its editor.
    await drawer.getByRole('button', { name: '关闭倒数日' }).click()
    await cell().click({ button: 'right' })
    await expect(menu.getByRole('menuitem')).toHaveText(['打开这一天的记录', '在这一天添加倒数日', '编辑倒数日「聚餐」'])
    await menu.getByRole('menuitem', { name: '编辑倒数日「聚餐」' }).click()
    await expect(drawer.locator('.cd-item.is-open')).toContainText('聚餐')
    await expect(drawer.locator('.cd-edit').getByLabel('名称')).toHaveValue('聚餐')

    // And the day's own record is one item away.
    await drawer.getByRole('button', { name: '关闭倒数日' }).click()
    await cell().click({ button: 'right' })
    await menu.getByRole('menuitem', { name: '打开这一天的记录' }).click()
    await expect(window.locator('.calendar-page')).toHaveCount(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('Esc backs out of the drawer one step at a time, and focus goes back to its button', async ({ sandbox }) => {
  await seedCountdowns(sandbox, [{ id: 1, name: '旅行', date: isoDate(5), color: '#34d399' }])
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    const opener = window.locator('.cd-strip-manage')
    await opener.focus()
    await opener.click()
    const drawer = window.locator('aside.cd-drawer')
    await expect(drawer).toBeVisible()
    // Focus is inside the drawer, and the drawer does not trap it (the calendar stays usable).
    await expect.poll(() => window.evaluate(() => Boolean(document.querySelector('.cd-drawer')?.contains(document.activeElement)))).toBe(true)

    await drawer.locator('.cd-row').first().click()
    await expect(drawer.locator('.cd-edit')).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(drawer.locator('.cd-edit')).toHaveCount(0)
    await expect(drawer).toBeVisible()

    await drawer.getByRole('button', { name: '＋ 新建倒数日' }).click()
    await expect(drawer.getByRole('form', { name: '新建倒数日' })).toBeVisible()
    await window.keyboard.press('Escape')
    await expect(drawer.getByRole('form', { name: '新建倒数日' })).toHaveCount(0)
    await expect(drawer).toBeVisible()
    // Focus stays in the drawer (on the button that opens the form), so the next Esc reaches it.
    await expect(drawer.getByRole('button', { name: '＋ 新建倒数日' })).toBeFocused()

    await window.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('deleting a countdown takes two clicks, and a long list scrolls with the way to add one in reach', async ({ sandbox }) => {
  await seedCountdowns(sandbox, Array.from({ length: 24 }, (_, index) => ({
    id: index + 1, name: `倒数${index + 1}`, date: isoDate(index + 1), color: '#34d399'
  })))
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    const drawer = await openDrawer(window)
    await expect(drawer.locator('.cd-row')).toHaveCount(24)
    // The drawer fits the window; the list scrolls inside it, and 新建 stays at the top of what is shown.
    const fits = await window.evaluate(() => {
      const box = document.querySelector('.cd-drawer').getBoundingClientRect()
      const body = document.querySelector('.cd-drawer-body')
      return box.top >= 0 && box.bottom <= window.innerHeight && body.scrollHeight > body.clientHeight
    })
    expect(fits).toBe(true)
    await drawer.locator('.cd-drawer-body').evaluate(el => { el.scrollTop = el.scrollHeight })
    const add = drawer.getByRole('button', { name: '＋ 新建倒数日' })
    await expect(add).toBeInViewport()

    // The first click on 删除 only asks; nothing is deleted until 确认删除.
    await drawer.locator('.cd-row', { hasText: '倒数24' }).click()
    await drawer.getByRole('button', { name: '删除', exact: true }).click()
    await expect(drawer.getByRole('button', { name: '确认删除' })).toBeFocused()
    await window.waitForTimeout(300)
    expect(await savedCountdowns(sandbox)).toHaveLength(24)
    await window.keyboard.press('Escape')
    await expect(drawer.getByRole('button', { name: '确认删除' })).toHaveCount(0)
    await expect(drawer.locator('.cd-edit')).toBeVisible()

    await drawer.getByRole('button', { name: '删除', exact: true }).click()
    await drawer.getByRole('button', { name: '确认删除' }).click()
    await expect(drawer.locator('.cd-row')).toHaveCount(23)
    await expect.poll(async () => (await savedCountdowns(sandbox)).length).toBe(23)
    expect((await savedCountdowns(sandbox)).some(item => item.name === '倒数24')).toBe(false)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('countdowns the file holds badly are listed, can be repaired, and nothing is written until then', async ({ sandbox }) => {
  const stored = [
    { id: 'c-bad', title: '坏日期', date: 'not-a-date', extra: 1 },
    { name: '没有编号', date: isoDate(3) }
  ]
  await seedCountdowns(sandbox, stored)
  const file = path.join(sandbox.dataDir, 'metadata.json')
  const before = await fs.readFile(file, 'utf8')
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    const drawer = await openDrawer(window)
    await expect(drawer.getByRole('region', { name: '日期无法识别' }).locator('.cd-row')).toContainText('（未命名）')
    await expect(drawer.getByRole('region', { name: '即将到来' }).locator('.cd-row')).toContainText('没有编号')
    await window.waitForTimeout(600)
    expect(await fs.readFile(file, 'utf8')).toBe(before)

    // Giving the unreadable one a date moves it up with the rest, and keeps what else it carried.
    await drawer.getByRole('region', { name: '日期无法识别' }).locator('.cd-row').click()
    await drawer.locator('.cd-edit input[type="date"]').fill(isoDate(8))
    await expect.poll(async () => (await savedCountdowns(sandbox))[0]?.date).toBe(isoDate(8))
    expect((await savedCountdowns(sandbox))[0]).toMatchObject({ id: 'c-bad', title: '坏日期', extra: 1 })
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the drawer, its editors and rows, the strip and the marks move into and out of place instead of jumping', async ({ sandbox }) => {
  await seedCountdowns(sandbox, [
    { id: 1, name: '旅行', date: isoDate(5), color: '#34d399' },
    { id: 2, name: '考试', date: isoDate(9), color: '#f87171' },
    { id: 3, name: '出发', date: isoDate(0), color: '#60a5fa' }
  ])
  const { app, window, problems } = await openCalendar(sandbox)
  try {
    // The mark on a day arrives with a motion of its own.
    const mark = window.locator('.month-grid .cal-day.today .cal-countdown-tag')
    await expect(mark).toHaveText('出发')
    expect(await mark.evaluate(el => getComputedStyle(el).animationName)).toBe('markerPop')

    // Opening the drawer folds the strip away; closing it brings the strip back.
    const strip = window.locator('.cd-strip-wrap')
    await expect(strip).not.toHaveClass(/is-hidden/)
    const drawer = await openDrawer(window)
    await expect(strip).toHaveClass(/is-hidden/)
    await expect(window.locator('.cd-strip-manage')).toBeHidden()

    // What goes is watched from the page, since a fold lasts only a moment.
    await window.evaluate(() => {
      window.__seen = { removing: false, folding: false }
      new MutationObserver(() => {
        if (document.querySelector('.cd-item.is-removing')) window.__seen.removing = true
        if (document.querySelector('.cd-item .presence.is-leaving > .unfold')) window.__seen.folding = true
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
    })

    // An editor unfolds to its full height and nothing inside it is left scrolled or cut off.
    await drawer.locator('.cd-row', { hasText: '旅行' }).click()
    const editor = drawer.locator('.cd-edit')
    await expect(editor).toBeVisible()
    await expect.poll(() => editor.evaluate(el => {
      const clip = el.closest('.unfold')
      return clip.getBoundingClientRect().height >= el.getBoundingClientRect().height && clip.scrollTop === 0
    })).toBe(true)

    // The step of a repeat opens under the options and folds away again.
    await editor.getByRole('radio', { name: '每周' }).click()
    await expect(editor.getByLabel('重复间隔')).toBeVisible()
    await editor.getByRole('radio', { name: '不重复' }).click()
    await expect(editor.getByLabel('重复间隔')).toHaveCount(0)

    // A deleted countdown's data goes at once, its row folds away after, and the editor folds with it.
    await editor.getByRole('button', { name: '删除', exact: true }).click()
    await editor.getByRole('button', { name: '确认删除' }).click()
    await expect.poll(async () => (await savedCountdowns(sandbox)).map(item => item.name)).toEqual(['考试', '出发'])
    await expect.poll(() => window.evaluate(() => window.__seen)).toEqual({ removing: true, folding: true })
    await expect(drawer.locator('.cd-item.is-removing')).toHaveCount(0)
    await expect(drawer.locator('.cd-row')).toHaveCount(2)

    // A new one grows into its place and is marked as new for a moment.
    await drawer.getByRole('button', { name: '＋ 新建倒数日' }).click()
    await drawer.getByLabel('名称').fill('聚餐')
    await drawer.locator('input[type="date"]').fill(isoDate(3))
    await drawer.getByRole('button', { name: '添加', exact: true }).click()
    await expect(drawer.locator('.cd-item.is-new')).toContainText('聚餐')
    await expect(drawer.locator('.cd-row')).toHaveCount(3)
    await expect(drawer.getByRole('form', { name: '新建倒数日' })).toHaveCount(0)

    await drawer.getByRole('button', { name: '关闭倒数日' }).click()
    await expect(drawer).toHaveCount(0)
    await expect(strip).not.toHaveClass(/is-hidden/)
    await expect(window.locator('.cd-strip-manage')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
