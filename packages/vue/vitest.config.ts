import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const core = (file: string) => fileURLToPath(new URL(`../core/src/${file}`, import.meta.url))

export default defineConfig({
  resolve: {
    // Test against the core's source so the suite needs no prior build.
    alias: [
      { find: /^@freepeace13\/inertia-live-core\/testing$/, replacement: core('testing.ts') },
      { find: /^@freepeace13\/inertia-live-core$/, replacement: core('index.ts') },
    ],
  },
  test: { globals: true, include: ['tests/**/*.test.{ts,tsx}'] },
})
