import { usePage } from '@inertiajs/vue3'
import { type Plugin, watch } from 'vue'
import {
  type ConnectionLike,
  type EchoLike,
  LiveClient,
  type LiveProp,
  type Reloader,
} from '../core/index.js'
import { LIVE_CLIENT_KEY } from './key.js'
import { inertiaReloader } from './reloader.js'

export interface InertiaLiveOptions {
  /** The app's configured laravel-echo instance. */
  echo: EchoLike
  /** Debounce window before reloading. Default 150. */
  debounceMs?: number
  /** Override connection observation for non-Pusher Echo drivers. */
  connection?: ConnectionLike
  /** Replace the default `router.reload` based reloader (mainly for tests). */
  reload?: Reloader
  /** Called when a live reload fails. */
  onError?: (error: unknown) => void
}

/**
 * Makes every page that carries a `_live` prop live: subscribes to its channels and
 * partially reloads the bound props when a change signal arrives.
 */
export const InertiaLive: Plugin<[InertiaLiveOptions]> = {
  install(app, options) {
    const client = new LiveClient({
      echo: options.echo,
      reload: options.reload ?? inertiaReloader,
      debounceMs: options.debounceMs,
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

    app.provide(LIVE_CLIENT_KEY, client)

    const unmount = app.unmount.bind(app)
    app.unmount = () => {
      stop()
      client.destroy()
      unmount()
    }
  },
}
