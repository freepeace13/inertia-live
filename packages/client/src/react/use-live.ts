import { useCallback, useContext, useSyncExternalStore } from 'react'
import type { LiveStatus } from '../core/index.js'
import { LiveContext } from './context.js'

export interface UseLive {
  status: LiveStatus
  lastSyncedAt: Date | null
  /** Hold reloads, e.g. while a form is being edited. Signals keep queueing. */
  pause: () => void
  /** Resume reloads, flushing anything queued while paused. */
  resume: () => void
  /** Reload every live prop now. */
  refresh: () => Promise<void>
}

const noopSubscribe = () => () => {}

export function useLive(): UseLive {
  const context = useContext(LiveContext)

  if (!context) {
    throw new Error('useLive() must be used inside <InertiaLiveProvider>.')
  }

  const { client } = context

  const subscribeStatus = useCallback(
    (notify: () => void) => (client ? client.onStatus(notify) : noopSubscribe()),
    [client],
  )
  const subscribeSynced = useCallback(
    (notify: () => void) => (client ? client.onSynced(notify) : noopSubscribe()),
    [client],
  )

  const status = useSyncExternalStore<LiveStatus>(
    subscribeStatus,
    () => client?.status ?? 'connecting',
    () => 'connecting',
  )
  const lastSyncedAt = useSyncExternalStore(
    subscribeSynced,
    () => client?.lastSyncedAt ?? null,
    () => null,
  )

  return {
    status,
    lastSyncedAt,
    pause: useCallback(() => client?.pause(), [client]),
    resume: useCallback(() => client?.resume(), [client]),
    refresh: useCallback(async () => client?.refresh(), [client]),
  }
}
