import { router } from '@inertiajs/vue3'
import type { Reloader } from '../core/index.js'

/**
 * Partial reload that resolves when the visit finishes and rejects if it reports errors. `router.reload` already preserves
 * scroll position and component state, so a live update never disturbs the user.
 */
export const inertiaReloader: Reloader = (only) =>
  new Promise<void>((resolve, reject) => {
    let failure: unknown
    router.reload({
      only,
      onError: (errors) => {
        failure = errors
      },
      onFinish: () => (failure === undefined ? resolve() : reject(failure)),
    })
  })
