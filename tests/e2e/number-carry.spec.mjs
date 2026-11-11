import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, launchApp } from './fixtures.mjs'

// A number section that carries its last value over: an empty day starts from the latest earlier
// number (here 72.5), the stepper is locked only while that number is being looked up, and a press
// afterwards acts on the carried value, not on a placeholder 0.

const pad = value => String(value).padStart(2, '0')

function dayFile(sandbox, daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return path.join(sandbox.dataDir, String(date.getFullYear()), pad(date.getMonth() + 1), `${pad(date.getDate())}.json`)
}

test('an empty day starts from the carried number and the stepper works on it', async ({ sandbox }) => {
  await fs.mkdir(sandbox.dataDir, { recursive: true })
  await fs.writeFile(path.join(sandbox.dataDir, 'sections.json'), JSON.stringify([
    { id: 'weight', name: '体重', type: 'number', unit: 'kg', numberDefaultMode: 'carry', resident: true, order: 0 },
    { id: 'steps', name: '步数', type: 'number', unit: '步', numberDefaultMode: 'zero', resident: true, order: 1 }
  ]))
  // The last weight was three days ago; the days in between hold only another section.
  const entries = [[3, { weight: { value: '72.5', updatedAt: new Date().toISOString() } }], [1, { steps: { value: '900', updatedAt: new Date().toISOString() } }]]
  for (const [daysAgo, content] of entries) {
    const file = dayFile(sandbox, daysAgo)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(content))
  }

  const { app, window, problems } = await launchApp(sandbox)
  try {
    await window.evaluate(() => window.api.config.set('onboardingDone', true))
    await window.reload()
    await window.waitForSelector('.sidebar')

    const weight = window.locator('.section-slot', { hasText: '体重' })
    const steps = window.locator('.section-slot', { hasText: '步数' })
    await expect(weight.locator('.number-input')).toHaveValue('72.5')
    await expect(weight.locator('.number-input-wrap')).not.toHaveAttribute('aria-busy', 'true')
    await expect(steps.locator('.number-input')).toHaveValue('0')

    // The stepper is usable once the number is known, and acts on it.
    await weight.getByRole('button', { name: '+' }).click()
    await expect(weight.locator('.number-input')).toHaveValue('73.5')
    await steps.getByRole('button', { name: '+' }).click()
    await expect(steps.locator('.number-input')).toHaveValue('1')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
