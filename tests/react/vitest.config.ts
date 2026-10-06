import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (file: string) => fileURLToPath(new URL(`../../packages/${file}`, import.meta.url))

export default defineConfig({
  resolve: {
    // Test against the packages' source so the suite needs no prior build, and keep a single
    // copy of the framework between the tests and the sources they import.
    dedupe: ['react', 'react-dom', '@inertiajs/react'],
    alias: [
      {
        find: /^@freepeace13\/inertia-live-core\/testing$/,
        replacement: src('core/src/testing.ts'),
      },
      { find: /^@freepeace13\/inertia-live-core$/, replacement: src('core/src/index.ts') },
      {
        find: /^@freepeace13\/inertia-live-react\/testing$/,
        replacement: src('react/src/testing.ts'),
      },
      { find: /^@freepeace13\/inertia-live-react$/, replacement: src('react/src/index.ts') },
    ],
  },
  test: { globals: true, include: ['*.test.{ts,tsx}'] },
})
