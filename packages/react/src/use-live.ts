import type { LiveStatus } from '@freepeace13/inertia-live-core'
import { useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { LiveContext } from './context.js'

export interface UseLive {
  status: LiveStatus
  lastSyncedAt: Date | null
  /** True when reloads gave up after repeated failures and the page may be outdated. */
  stale: boolean
  /** Hold reloads, e.g. while a form is being edited. Signals keep queueing. */
  pause: () => void
  /** Resume reloads, flushing anything queued while paused. */
  resume: () => void
  /** Reload every live prop now. */
  refresh: () => Promise<void>
}

interface Hold {
  release: (() => void) | null
}

const noopSubscribe = () => () => {}

export function useLive(): UseLive {
  const context = useContext(LiveContext)

  if (!context) {
    throw new Error('useLive() must be used inside <InertiaLiveProvider>.')
  }

  const { client } = context

  // Pauses held by this component only: resume() never releases another component's pause,
  // and they are all released when this component unmounts. A pause requested before the
  // provider has created its client (e.g. in a child's mount effect) is applied once it exists.
  const held = useRef<Hold[]>([])
  useEffect(() => {
    if (!client) return
    for (const hold of held.current) hold.release ??= client.pause()

    return () => {
      for (const hold of held.current) {
        hold.release?.()
        hold.release = null
      }
    }
  }, [client])
  useEffect(
    () => () => {
      held.current.length = 0
    },
    [],
  )

  const subscribeStatus = useCallback(
    (notify: () => void) => (client ? client.onStatus(notify) : noopSubscribe()),
    [client],
  )
  const subscribeSynced = useCallback(
    (notify: () => void) => (client ? client.onSynced(notify) : noopSubscribe()),
    [client],
  )

  const subscribeStale = useCallback(
    (notify: () => void) => (client ? client.onStale(notify) : noopSubscribe()),
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
  const stale = useSyncExternalStore(
    subscribeStale,
    () => client?.stale ?? false,
    () => false,
  )

  return {
    status,
    lastSyncedAt,
    stale,
    pause: useCallback(() => {
      held.current.push({ release: client?.pause() ?? null })
    }, [client]),
    resume: useCallback(() => {
      held.current.pop()?.release?.()
    }, []),
    refresh: useCallback(async () => client?.refresh(), [client]),
  }
}
