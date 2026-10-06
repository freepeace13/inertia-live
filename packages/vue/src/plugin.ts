import {
  type ConnectionLike,
  type EchoLike,
  LiveClient,
  type LiveProp,
  type Reloader,
  withSocketId,
} from '@freepeace13/inertia-live-core'
import { router, usePage } from '@inertiajs/vue3'
import { type Plugin, watch } from 'vue'
import { LIVE_CLIENT_KEY } from './key.js'
import { inertiaReloader } from './reloader.js'

export interface InertiaLiveOptions {
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
}

/** Stands in for the client during SSR: always `connecting`, never subscribes or reloads. */
function serverClient(): LiveClient {
  const inert = {
    status: 'connecting',
    lastSyncedAt: null,
    onStatus: () => () => {},
    onSynced: () => () => {},
    sync: () => {},
    pause: () => () => {},
    resume: () => {},
    resetPause: () => {},
    refresh: async () => {},
    destroy: () => {},
  }
  return inert as unknown as LiveClient
}

/**
 * Makes every page that carries a `_live` prop live: subscribes to its channels and
 * partially reloads the bound props when a change signal arrives.
 */
export const InertiaLive: Plugin<[InertiaLiveOptions]> = {
  install(app, options) {
    // No sockets or router listeners on the server: provide an inert client so `useLive()` works.
    if (typeof window === 'undefined') {
      app.provide(LIVE_CLIENT_KEY, serverClient())
      return
    }

    const client = new LiveClient({
      echo: options.echo,
      reload: options.reload ?? inertiaReloader,
      debounceMs: options.debounceMs,
      maxWaitMs: options.maxWaitMs,
      connection: options.connection,
      onError: options.onError,
    })

    const page = usePage()

    // `_live` is a new object on every navigation and reload, so this keeps
    // subscriptions and cursors in step with whatever page is showing.
    const stop = watch(
      () => (page.props as { _live?: LiveProp } | undefined)?._live,
      (live) => client.sync(live),
      { immediate: true },
    )

    // Let the server skip the sender's own signal, and drop pauses left over from the old page.
    const stopBefore = router.on('before', (event) =>
      withSocketId(options.echo, event.detail.visit.headers),
    )
    const stopNavigate = router.on('navigate', () => client.resetPause())

    app.provide(LIVE_CLIENT_KEY, client)

    const unmount = app.unmount.bind(app)
    app.unmount = () => {
      stop()
      stopBefore()
      stopNavigate()
      client.destroy()
      unmount()
    }
  },
}
