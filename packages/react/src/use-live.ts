import type { LiveStatus } from '@freepeace13/inertia-live-core'
import { useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
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

  // Pauses held by this component only: resume() never releases another component's pause,
  // and they are all released when this component unmounts.
  const held = useRef<Array<() => void>>([])
  useEffect(
    () => () => {
      held.current.splice(0).forEach((release) => release())
    },
    [client],
  )

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
    pause: useCallback(() => {
      if (client) held.current.push(client.pause())
    }, [client]),
    resume: useCallback(() => {
      held.current.pop()?.()
    }, [client]),
    refresh: useCallback(async () => client?.refresh(), [client]),
  }
}
