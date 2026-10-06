import { router, usePage } from '@inertiajs/react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  type ConnectionLike,
  type EchoLike,
  LiveClient,
  type LiveProp,
  type Reloader,
  withSocketId,
} from '../core/index.js'
import { LiveContext } from './context.js'
import { inertiaReloader } from './reloader.js'

export interface InertiaLiveProviderProps {
  /** The app's configured laravel-echo instance. */
  echo: EchoLike
  /** Debounce window before reloading. Default 150. */
  debounceMs?: number
  /** Override connection observation for non-Pusher Echo drivers. */
  connection?: ConnectionLike
  /** Longest a steady signal stream can postpone a reload. Default `debounceMs * 4`. */
  maxWaitMs?: number
  /** Replace the default `router.reload` based reloader (mainly for tests). */
  reload?: Reloader
  /** Called when a live reload fails. */
  onError?: (error: unknown) => void
  children?: ReactNode
}

/**
 * Makes every page that carries a `_live` prop live. Render it inside the Inertia tree,
 * in a persistent layout, because it reads the current page with `usePage()`.
 */
export function InertiaLiveProvider({
  echo,
  debounceMs,
  maxWaitMs,
  connection,
  reload,
  onError,
  children,
}: InertiaLiveProviderProps) {
  const [client, setClient] = useState<LiveClient | null>(null)

  // Callbacks change identity every render; keep the latest without recreating the client.
  const latest = useRef({ reload, onError })
  latest.current = { reload, onError }

  // Create the client in an effect, so React StrictMode's mount/unmount/mount cycle
  // destroys and recreates it cleanly instead of leaking subscriptions.
  useEffect(() => {
    const created = new LiveClient({
      echo,
      debounceMs,
      maxWaitMs,
      connection,
      reload: (only) => (latest.current.reload ?? inertiaReloader)(only),
      onError: (error) => latest.current.onError?.(error),
    })
    setClient(created)

    // Let the server skip the sender's own signal, and drop pauses left over from the old page.
    const stopBefore = router.on('before', (event) =>
      withSocketId(echo, event.detail.visit.headers),
    )
    const stopNavigate = router.on('navigate', () => created.resetPause())

    return () => {
      stopBefore()
      stopNavigate()
      created.destroy()
      setClient(null)
    }
  }, [echo, debounceMs, maxWaitMs, connection])

  // `_live` is a new object on every navigation and reload, so this keeps
  // subscriptions and cursors in step with whatever page is showing.
  const live = (usePage().props as { _live?: LiveProp } | undefined)?._live

  useEffect(() => {
    client?.sync(live)
  }, [client, live])

  const value = useMemo(() => ({ client }), [client])

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}
