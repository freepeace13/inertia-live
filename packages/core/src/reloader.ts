import { ReloadCancelled, type Reloader } from './types.js'

/** The slice of Inertia's `router` that the live reloader uses. */
export interface ReloadRouter {
  reload(options: {
    only: string[]
    onError: (errors: unknown) => void
    onCancel: () => void
    onFinish: () => void
  }): unknown
}

/**
 * Partial reload that resolves when the visit finishes, rejects if it reports errors, and
 * rejects with `ReloadCancelled` if another visit cancels it. `router.reload` already preserves
 * scroll position and component state, so a live update never disturbs the user.
 */
export const createInertiaReloader =
  (router: ReloadRouter): Reloader =>
  (only) =>
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
