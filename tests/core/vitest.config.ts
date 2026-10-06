import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (file: string) => fileURLToPath(new URL(`../../packages/${file}`, import.meta.url))

export default defineConfig({
  resolve: {
    // Test against the package source so the suite needs no prior build.
    alias: [
      {
        find: /^@freepeace13\/inertia-live-core\/testing$/,
        replacement: src('core/src/testing.ts'),
      },
      { find: /^@freepeace13\/inertia-live-core$/, replacement: src('core/src/index.ts') },
    ],
  },
  test: { globals: true, include: ['*.test.{ts,tsx}'] },
})
