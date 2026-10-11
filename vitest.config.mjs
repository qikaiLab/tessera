import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Playwright owns tests/e2e; vitest must not try to run those specs.
    exclude: [...configDefaults.exclude, 'tests/e2e/**']
  }
})
