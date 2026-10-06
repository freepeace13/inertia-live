import { createFakeLive as createFakeCoreLive } from '../core/testing.js'
import type { InertiaLiveProviderProps } from './provider.js'

/**
 * Fake Echo plus provider props for tests:
 *
 *   const fake = createFakeLive()
 *   render(<InertiaLiveProvider {...fake.providerProps}>…</InertiaLiveProvider>)
 *   fake.emit('documents.a', 1)
 *   // fake.reloads holds every `only` list passed to router.reload
 */
export function createFakeLive(options: { channelPrefix?: string; debounceMs?: number } = {}) {
  const fake = createFakeCoreLive(options)

  return {
    ...fake,
    providerProps: {
      echo: fake.echo,
      reload: fake.reload,
      debounceMs: options.debounceMs,
    } satisfies InertiaLiveProviderProps,
  }
}
