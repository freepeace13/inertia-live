import { createInertiaReloader } from '@freepeace13/inertia-live-core'
import { router } from '@inertiajs/react'

/** Live partial reload through Inertia's router. See `createInertiaReloader`. */
export const inertiaReloader = createInertiaReloader(router)
