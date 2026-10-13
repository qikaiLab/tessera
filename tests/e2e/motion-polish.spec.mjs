import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

const pad = value => String(value).padStart(2, '0')

async function seedNotes(sandbox, count = 3) {
  const notesDir = path.join(sandbox.dataDir, 'notes')
  await fs.mkdir(notesDir, { recursive: true })
  const index = []
  for (let number = 1; number <= count; number += 1) {
    const stamp = `2026-05-0${number}T08:00:00.000Z`
    const meta = { id: `n${number}`, title: `便签 ${number}`, createdAt: stamp, updatedAt: stamp, pinned: false, archived: false, fontSize: 14, dateLink: null }
    index.push(meta)
    await fs.writeFile(path.join(notesDir, `n${number}.json`), JSON.stringify({
      ...meta,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `便签 ${number} 的正文` }] }] }
    }))
  }
  await fs.writeFile(path.join(notesDir, 'index.json'), JSON.stringify(index))
}

async function openApp(sandbox) {
  const launched = await launchApp(sandbox)
  await launched.window.evaluate(() => window.api.config.set('onboardingDone', true))
  await launched.window.reload()
  await launched.window.waitForSelector('.sidebar')
  return launched
}

test('the notes page goes straight to its content without a placeholder flash', async ({ sandbox }) => {
  await seedNotes(sandbox)
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(500)
    // Watch every frame of the page change: no skeleton, and never a "0 条" count.
    await window.evaluate(() => {
      window.__flashes = []
      const start = performance.now()
      const frame = now => {
        if (document.querySelector('.notes-list-loading, .notes-editor-loading')) window.__flashes.push('skeleton')
        if (document.querySelector('.notes-count')?.textContent.trim().startsWith('0 ')) window.__flashes.push('zero count')
        if (now - start < 900) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    await window.locator('.nav-item', { hasText: '便签' }).click()
    await expect(window.locator('.notes-list-item')).toHaveCount(3)
    await window.waitForTimeout(900)
    expect(await window.evaluate(() => window.__flashes)).toEqual([])
    await expect(window.locator('.notes-count')).toHaveText('3 条')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('timeline cards play their entrance as they scroll into view', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'diary', name: '日记', type: 'text', unit: '', resident: true, order: 0 }
  ]))
  for (let daysAgo = 1; daysAgo <= 60; daysAgo += 1) {
    const date = new Date(2026, 0, 1)
    date.setDate(date.getDate() - daysAgo)
    const file = path.join(sandbox.dataDir, String(date.getFullYear()), pad(date.getMonth() + 1), `${pad(date.getDate())}.json`)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify({
      diary: {
        value: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `记录 ${daysAgo}` }] }] }),
        updatedAt: new Date().toISOString()
      }
    }))
  }
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '时间线' }).click()
    const cards = window.locator('.timeline-card')
    await expect(cards.first()).toBeVisible()
    const state = () => window.evaluate(() => {
      const all = [...document.querySelectorAll('.timeline-card')]
      const list = document.querySelector('.timeline-list').getBoundingClientRect()
      const onScreen = all.filter(card => {
        const rect = card.getBoundingClientRect()
        // Only cards with a real part of their height showing inside the list count as "in view".
        return rect.top < list.bottom - 24 && rect.bottom > list.top + 24
      })
      return {
        total: all.length,
        revealed: all.filter(card => card.dataset.reveal === 'in').length,
        onScreenPending: onScreen.filter(card => card.dataset.reveal !== 'in').length
      }
    })

    // Everything on screen has arrived; what is still below the fold is waiting.
    await expect.poll(async () => (await state()).onScreenPending).toBe(0)
    const first = await state()
    expect(first.revealed).toBeGreaterThan(3)
    expect(first.revealed).toBeLessThan(first.total)

    // Scrolling brings the rest in as it appears.
    await window.locator('.timeline-list').evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect.poll(async () => (await state()).onScreenPending).toBe(0)
    expect((await state()).revealed).toBeGreaterThan(first.revealed)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('leaving fullscreen plays an exit over the restored page', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(600)
    await window.locator('.fullscreen-btn').first().click()
    const shell = window.locator('.tiptap-shell.tiptap-fullscreen')
    await expect(shell).toBeVisible()
    await window.waitForTimeout(500)

    await window.keyboard.press('Escape')
    // The overlay lingers, marked as leaving, while it fades away...
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen.is-leaving')).toHaveCount(1)
    // ...and the card's own styling stays fullscreen-safe until then.
    await expect(window.locator('.section-card.fullscreen-active-parent')).toHaveCount(1)
    // Afterwards everything is back to normal.
    await expect(shell).toHaveCount(0)
    await expect(window.locator('.section-card.fullscreen-active-parent')).toHaveCount(0)
    await expect(window.locator('.fullscreen-btn').first()).toBeVisible()

    // Going fullscreen again straight away works.
    await window.locator('.fullscreen-btn').first().click()
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen:not(.is-leaving)')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('adding a record grows it into place, scrolls to it and focuses it', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  const resident = Array.from({ length: 6 }, (_, index) => ({
    id: `r${index}`, name: `常驻${index}`, type: 'text', unit: '', resident: true, order: index
  }))
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    ...resident,
    { id: 'extra', name: '额外记录', type: 'text', unit: '', resident: false, order: 6 }
  ]))
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(700)
    const content = window.locator('.today-content')
    const addButton = window.getByRole('button', { name: '+ 额外记录' })
    await addButton.scrollIntoViewIfNeeded()

    await addButton.click()
    const slot = window.locator('[data-section-slot="extra"]')
    await expect(slot).toHaveClass(/is-adding/)
    // It grows from nothing instead of popping in, so the cards below slide rather than jump.
    const heights = []
    for (let sample = 0; sample < 6; sample += 1) {
      heights.push(await slot.evaluate(el => Math.round(el.getBoundingClientRect().height)))
      await window.waitForTimeout(60)
    }
    expect(Math.min(...heights)).toBeLessThan(heights[heights.length - 1])

    // Once settled: the card is on screen, the caret is in it, and the marker class is gone.
    await expect(slot).not.toHaveClass(/is-adding/, { timeout: 5000 })
    await expect(slot.locator('.ProseMirror')).toBeFocused()
    const fullyVisible = await slot.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const view = document.querySelector('.today-content').getBoundingClientRect()
      return box.top >= view.top - 1 && box.bottom <= view.bottom + 1
    })
    expect(fullyVisible).toBe(true)
    await expect(content).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('drawer notes open and fold with an animation and the mode tabs slide', async ({ sandbox }) => {
  await seedNotes(sandbox, 2)
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(600)
    await window.locator('.today-notes-toggle').first().click()
    const tabs = window.locator('.notes-drawer-tabs')
    await expect(tabs).toHaveClass(/has-thumb/)

    // Latest lists every note; the highlight slides to its tab.
    const thumbX = () => tabs.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el, '::before').transform).m41)
    const latest = tabs.getByRole('button', { name: '最新' })
    await latest.click()
    await expect.poll(thumbX).toBeCloseTo(await latest.evaluate(el => el.offsetLeft), 0)
    await expect(window.locator('.notes-drawer-item')).toHaveCount(2)

    // Opening a note: the compact card folds shut while the editing card opens in its place.
    const item = window.locator('.notes-drawer-item').first()
    await item.locator('.notes-drawer-card').first().click()
    await expect(item.locator('.notes-drawer-card.editing')).toBeVisible()
    await expect(item.locator(':scope > .collapsible').first()).not.toHaveClass(/is-open/)
    await expect(item.locator(':scope > .collapsible').nth(1)).toHaveClass(/is-open/)

    // Folding it back keeps the editor around just long enough to animate, then removes it.
    await item.getByRole('button', { name: '收起' }).click()
    await expect(item.locator(':scope > .collapsible').first()).toHaveClass(/is-open/)
    await expect(item.locator('.notes-drawer-card.editing')).toHaveCount(0)
    await expect(item.locator('.notes-drawer-card')).toHaveCount(1)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the calendar slides between months and views and sweeps its cells in', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '日历' }).click()
    const slide = window.locator('.cal-slide')
    await expect(slide).toBeVisible()
    const title = window.locator('.cal-header-title')
    const first = await title.textContent()

    await window.getByLabel('下一页').click()
    await expect(window.locator('.cal-slide.cal-slide-next')).toHaveCount(1)
    await expect(title).not.toHaveText(first)
    await window.getByLabel('上一页').click()
    await expect(window.locator('.cal-slide.cal-slide-prev')).toHaveCount(1)
    await expect(title).toHaveText(first)

    await window.locator('.tabs .tab').nth(1).click()
    await expect(window.locator('.cal-slide.cal-slide-view')).toHaveCount(1)
    await expect(window.locator('.week-view')).toBeVisible()
    // Cells arrive one after another, then all rest fully visible.
    await expect.poll(() => window.locator('.cal-slide .cal-day').evaluateAll(
      cells => Math.min(...cells.map(cell => Number(getComputedStyle(cell).opacity)))
    )).toBe(1)
    await window.locator('.tabs .tab').nth(2).click()
    await expect(window.locator('.year-view')).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('leaving fullscreen keeps the record page steady and the titlebar fading, never snapping', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(600)
    const card = '.sections-grid .section-card:not(.number-card)'
    await window.evaluate(() => {
      window.__watch = (ms) => new Promise(resolve => {
        const rows = []
        const start = performance.now()
        const frame = now => {
          const el = document.querySelector('.sections-grid .section-card:not(.number-card)')
          const add = document.querySelector('.today-add-section')
          const alpha = value => {
            const match = value.match(/rgba?\(([^)]+)\)/)
            if (!match) return 0
            const parts = match[1].split(',').map(Number)
            return parts.length > 3 ? parts[3] : 1
          }
          rows.push({
            height: Math.round(el.getBoundingClientRect().height),
            addTop: Math.round(add.getBoundingClientRect().top),
            opacity: Number(getComputedStyle(el).opacity),
            titlebar: alpha(getComputedStyle(document.querySelector('.titlebar')).backgroundColor)
          })
          if (now - start < ms) requestAnimationFrame(frame)
          else resolve(rows)
        }
        requestAnimationFrame(frame)
      })
    })
    const before = await window.evaluate((selector) => ({
      height: Math.round(document.querySelector(selector).getBoundingClientRect().height),
      addTop: Math.round(document.querySelector('.today-add-section').getBoundingClientRect().top)
    }), card)
    const biggestStep = (rows, key) => Math.max(0, ...rows.slice(1).map((row, index) => Math.abs(row[key] - rows[index][key])))

    // Going in: the card holds its size and the titlebar surface fades out.
    await window.evaluate(() => { window.__enter = window.__watch(700) })
    await window.locator('.fullscreen-btn').first().click()
    const entering = await window.evaluate(() => window.__enter)
    expect(entering.every(row => row.height === before.height && row.addTop === before.addTop)).toBe(true)
    expect(biggestStep(entering, 'titlebar')).toBeLessThan(0.6)

    // Coming out: nothing below moves, the card never fades back in from nothing, the
    // titlebar surface returns gradually.
    await window.evaluate(() => { window.__leave = window.__watch(900) })
    await window.keyboard.press('Escape')
    const leaving = await window.evaluate(() => window.__leave)
    expect(leaving.every(row => row.height === before.height && row.addTop === before.addTop)).toBe(true)
    expect(leaving.every(row => row.opacity === 1)).toBe(true)
    expect(biggestStep(leaving, 'titlebar')).toBeLessThan(0.6)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('calendar month changes never flash a scrollbar', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.locator('.nav-item', { hasText: '日历' }).click()
    await expect(window.locator('.cal-slide')).toBeVisible()
    await window.waitForTimeout(700)
    await window.evaluate(() => {
      window.__overflow = (ms) => new Promise(resolve => {
        const scroller = document.querySelector('.cal-content')
        const start = performance.now()
        // Scrollbars take room from the box: a horizontal one shows as offsetHeight - clientHeight.
        // The vertical bar may legitimately appear once (a month with more weeks), but it must
        // not blink on and off.
        const result = { wider: 0, taller: 0 }
        let barWidth = scroller.offsetWidth - scroller.clientWidth
        const frame = now => {
          if (scroller.offsetHeight - scroller.clientHeight > 0) result.wider += 1
          const width = scroller.offsetWidth - scroller.clientWidth
          if (width !== barWidth) { result.taller += 1; barWidth = width }
          if (now - start < ms) requestAnimationFrame(frame)
          else resolve(result)
        }
        requestAnimationFrame(frame)
      })
    })
    for (const action of ['下一页', '下一页', '上一页']) {
      await window.evaluate(() => { window.__run = window.__overflow(700) })
      await window.getByLabel(action).click()
      const result = await window.evaluate(() => window.__run)
      expect(result.wider).toBe(0)
      expect(result.taller).toBeLessThanOrEqual(1)
      await window.waitForTimeout(100)
    }
    for (const tab of [1, 2, 0]) {
      await window.evaluate(() => { window.__run = window.__overflow(700) })
      await window.locator('.tabs .tab').nth(tab).click()
      const result = await window.evaluate(() => window.__run)
      expect(result.wider).toBe(0)
      await window.waitForTimeout(100)
    }
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('a hovered drawer note keeps its whole border', async ({ sandbox }) => {
  await seedNotes(sandbox, 2)
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(600)
    await window.locator('.today-notes-toggle').first().click()
    await window.locator('.notes-drawer-tabs').getByRole('button', { name: '最新' }).click()
    const card = window.locator('.notes-drawer-item .notes-drawer-card').first()
    await expect(card).toBeVisible()
    await window.waitForTimeout(800)
    await card.hover()
    await window.waitForTimeout(400)
    // The folding wrapper clips whatever sticks out of it, so the card must stay inside.
    const inside = await card.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const clip = el.closest('.collapsible-inner').getBoundingClientRect()
      return box.left >= clip.left && box.right <= clip.right && box.top >= clip.top && box.bottom <= clip.bottom
    })
    expect(inside).toBe(true)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the fullscreen exit button sits left of the window controls and never overlaps anything', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.waitForTimeout(600)
    await window.locator('.fullscreen-btn').first().click()
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toBeVisible()
    await window.waitForTimeout(600)

    const measure = () => window.evaluate(() => {
      const rect = selector => {
        const el = document.querySelector(selector)
        if (!el) return null
        const box = el.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      }
      const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      const exit = rect('.fullscreen-exit-btn')
      const controls = [...document.querySelectorAll('.titlebar-btn')].map(el => {
        const box = el.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      })
      const header = ['.tiptap-char-count', '.tiptap-width-toggle', '.tiptap-font-controls'].map(rect)
      return {
        width: window.innerWidth,
        exit,
        leftOfControls: controls.every(box => exit.right <= box.left),
        sameRow: controls.every(box => Math.abs(box.top + box.bottom - exit.top - exit.bottom) < 6),
        controlsOverlap: controls.some(box => overlaps(exit, box)),
        headerOverlap: header.some(box => overlaps(exit, box)),
        inside: exit.left >= 0 && exit.right <= window.innerWidth
      }
    })

    for (const width of [520, 760, 900, 1100, 1500]) {
      await app.evaluate(({ BrowserWindow }, size) => {
        const win = BrowserWindow.getAllWindows()[0]
        // The app's own minimum is 900; the layout should hold for any size, so lift it here.
        win.setMinimumSize(320, 300)
        win.setSize(size, 760)
      }, width)
      await window.waitForTimeout(400)
      // Both column widths: the standard one is narrower than the window, the wide one may fill it.
      for (const label of ['↔ 宽屏', '→← 标准']) {
        const result = await measure()
        expect(result.leftOfControls, `exit left of controls @${width}`).toBe(true)
        expect(result.sameRow, `exit aligned with controls @${width}`).toBe(true)
        expect(result.controlsOverlap, `exit/controls overlap @${width}`).toBe(false)
        expect(result.headerOverlap, `exit/header overlap @${width}`).toBe(false)
        expect(result.inside).toBe(true)
        await window.getByRole('button', { name: label }).click().catch(() => {})
        await window.waitForTimeout(150)
      }
    }
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})

test('the card never flashes dark after fullscreen closes', async ({ sandbox }) => {
  const { app, window, problems } = await openApp(sandbox)
  try {
    await window.evaluate(async () => {
      await window.api.config.set('interfaceStyle', 'frosted-glass')
      await window.api.config.set('theme', 'dark')
    })
    await window.reload()
    await window.waitForSelector('.sidebar')
    await window.waitForTimeout(600)
    await window.locator('.fullscreen-btn').first().click()
    await expect(window.locator('.tiptap-shell.tiptap-fullscreen')).toBeVisible()
    await window.waitForTimeout(500)
    await window.evaluate(() => {
      window.__flash = new Promise(resolve => {
        const start = performance.now()
        let worst = 0
        const frame = now => {
          // Once the fullscreen layer is gone the editor shell is part of the card again and
          // must be see-through; it used to fade out slowly from the layer's opaque background.
          const shell = document.querySelector('.sections-grid .tiptap-shell:not(.tiptap-fullscreen)')
          if (shell) {
            const match = getComputedStyle(shell).backgroundColor.match(/rgba?\(([^)]+)\)/)
            const parts = match ? match[1].split(',').map(Number) : [0, 0, 0, 0]
            worst = Math.max(worst, parts.length > 3 ? parts[3] : 1)
          }
          if (now - start < 900) requestAnimationFrame(frame)
          else resolve(worst)
        }
        requestAnimationFrame(frame)
      })
    })
    await window.keyboard.press('Escape')
    expect(await window.evaluate(() => window.__flash)).toBe(0)
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
