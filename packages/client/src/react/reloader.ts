import { router } from '@inertiajs/react'
import type { Reloader } from '../core/index.js'

/**
 * Partial reload that resolves when the visit finishes. `router.reload` already preserves
 * scroll position and component state, so a live update never disturbs the user.
 */
export const inertiaReloader: Reloader = (only) =>
  new Promise<void>((resolve) => {
    router.reload({ only, onFinish: () => resolve() })
  })
