import type { LiveStatus } from '@freepeace13/inertia-live-core'
import { getCurrentScope, inject, onScopeDispose, type Ref, ref } from 'vue'
import { LIVE_CLIENT_KEY } from './key.js'

export interface UseLive {
  status: Ref<LiveStatus>
  lastSyncedAt: Ref<Date | null>
  /** Hold reloads, e.g. while a form is being edited. Signals keep queueing. */
  pause: () => void
  /** Resume reloads, flushing anything queued while paused. */
  resume: () => void
  /** Reload every live prop now. */
  refresh: () => Promise<void>
}

export function useLive(): UseLive {
  const client = inject(LIVE_CLIENT_KEY, null)

  if (!client) {
    throw new Error('useLive() needs the InertiaLive plugin: app.use(InertiaLive, { echo }).')
  }

  const status = ref<LiveStatus>(client.status)
  const lastSyncedAt = ref<Date | null>(client.lastSyncedAt)

  // Pauses held by this component only: resume() never releases another component's pause,
  // and they are all released when this component goes away.
  const held: Array<() => void> = []
  const releaseAll = () => held.splice(0).forEach((release) => release())

  const stops = [
    client.onStatus((next) => {
      status.value = next
    }),
    client.onSynced((at) => {
      lastSyncedAt.value = at
    }),
  ]

  if (getCurrentScope())
    onScopeDispose(() => {
      stops.forEach((stop) => stop())
      releaseAll()
    })

  return {
    status,
    lastSyncedAt,
    pause: () => {
      held.push(client.pause())
    },
    resume: () => {
      held.pop()?.()
    },
    refresh: () => client.refresh(),
  }
}
