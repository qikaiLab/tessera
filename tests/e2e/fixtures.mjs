import { test as base, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export async function launchApp(sandbox) {
  const app = await electron.launch({
    args: [projectRoot],
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: '',
      MOTOTRACE_USER_DATA_DIR: sandbox.userDataDir,
      MOTOTRACE_DATA_DIR: sandbox.dataDir
    }
  })
  const window = await app.firstWindow()
  const problems = []
  window.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
  window.on('console', message => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })
  await window.waitForSelector('.sidebar')
  return { app, window, problems }
}

export const test = base.extend({
  // Throwaway userData + data directories, so no run can touch real user records.
  sandbox: async ({}, use) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mototrace-e2e-'))
    const sandbox = {
      root,
      userDataDir: path.join(root, 'user-data'),
      dataDir: path.join(root, 'data')
    }
    await use(sandbox)
    await fs.rm(root, { recursive: true, force: true })
  }
})

export { expect }
