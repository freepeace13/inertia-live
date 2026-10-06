import { createFakeLive as createFakeCoreLive } from '@freepeace13/inertia-live-core/testing'
import type { InertiaLiveOptions } from './plugin.js'

/**
 * Fake Echo plus plugin options for tests:
 *
 *   const fake = createFakeLive()
 *   app.use(InertiaLive, fake.options)
 *   fake.emit('documents.a', 1)
 *   // fake.reloads holds every `only` list passed to router.reload
 */
export function createFakeLive(options: { channelPrefix?: string; debounceMs?: number } = {}) {
  const fake = createFakeCoreLive(options)

  return {
    ...fake,
    options: {
      echo: fake.echo,
      reload: fake.reload,
      debounceMs: options.debounceMs,
    } satisfies InertiaLiveOptions,
  }
}
