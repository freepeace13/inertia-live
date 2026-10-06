import { ReloadCancelled, type Reloader } from '@freepeace13/inertia-live-core'
import { router } from '@inertiajs/react'

/**
 * Partial reload that resolves when the visit finishes and rejects if it reports errors or another visit cancels it. `router.reload` already preserves
 * scroll position and component state, so a live update never disturbs the user.
 */
export const inertiaReloader: Reloader = (only) =>
  new Promise<void>((resolve, reject) => {
    let failure: unknown
    let cancelled = false
    router.reload({
      only,
      onError: (errors) => {
        failure = errors
      },
      onCancel: () => {
        cancelled = true
      },
      onFinish: () => {
        if (cancelled) reject(new ReloadCancelled())
        else if (failure !== undefined) reject(failure)
        else resolve()
      },
    })
  })
