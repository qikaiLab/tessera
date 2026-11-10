import { test, expect, launchApp } from './fixtures.mjs'

test('the page runs under a policy that blocks the network and injected scripts', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const policy = await window.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content)
    expect(policy).toContain("script-src 'self'")

    const outcome = await window.evaluate(async () => {
      let fetched = 'allowed'
      try { await fetch('https://example.com/'); } catch { fetched = 'blocked' }
      window.__injected = false
      const script = document.createElement('script')
      script.textContent = 'window.__injected = true'
      document.head.append(script)
      return { fetched, injected: window.__injected }
    })
    expect(outcome).toEqual({ fetched: 'blocked', injected: false })

    // Violations are reported as console errors; the app itself triggered none at startup.
    expect(problems.filter(item => !item.includes('example.com') && !item.includes('Content Security Policy'))).toEqual([])
  } finally {
    await app.close()
  }
})
