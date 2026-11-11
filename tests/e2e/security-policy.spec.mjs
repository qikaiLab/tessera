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

test('the renderer is sandboxed, has no Node access, and still reaches the clipboard through the bridge', async ({ sandbox }) => {
  const { app, window, problems } = await launchApp(sandbox)
  try {
    const preferences = await app.evaluate(({ BrowserWindow }) => {
      const { sandbox: sandboxed, contextIsolation, nodeIntegration } = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
      return { sandboxed, contextIsolation, nodeIntegration }
    })
    expect(preferences).toEqual({ sandboxed: true, contextIsolation: true, nodeIntegration: false })
    expect(await window.evaluate(() => [typeof require, typeof process, typeof window.api])).toEqual(['undefined', 'undefined', 'object'])

    // The sandboxed preload has no clipboard module: the bridge asks the main process, both ways.
    await app.evaluate(({ clipboard }) => clipboard.writeText('from the system'))
    expect(await window.evaluate(() => window.api.clipboard.readText())).toBe('from the system')
    await window.evaluate(() => window.api.clipboard.writeText('from the page'))
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('from the page')
    expect(problems).toEqual([])
  } finally {
    await app.close()
  }
})
