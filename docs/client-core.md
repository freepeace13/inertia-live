# Client core

`@freepeace13/inertia-live-core` exports a framework-agnostic `LiveClient`. The Vue and React adapters are thin wrappers that add page watching, a `router.reload` reloader and status bindings. Use the core directly for another framework or custom setups.

```ts
import { LiveClient } from '@freepeace13/inertia-live-core'

const client = new LiveClient({
  echo, // your configured laravel-echo instance
  reload: (only) => reloadPage({ only }), // resolve when the reload has finished
  debounceMs: 150,
})

client.sync(page.props._live) // on every navigation
client.afterReload(page.props._live) // after every reload
const release = client.pause() // while a form is being edited
release()
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `echo` | `EchoLike` | required | The laravel-echo instance (or anything with `private`, `channel`, `leave`) |
| `reload` | `Reloader` | required | `(only: string[]) => Promise<void>`. Must resolve when the reload finishes |
| `debounceMs` | `number` | `150` | Quiet window before reloading. `0` reloads immediately |
| `connection` | `ConnectionLike` | Echo's Pusher connection | Override connection observation for other drivers |
| `maxWaitMs` | `number` | `debounceMs * 4` | Longest a steady stream of signals can postpone a reload |
| `onError` | `(error) => void` | none | Called each time `reload` rejects. The props are re-queued and retried with backoff (1 s doubling to 30 s, 5 retries) |

## Methods and properties

| Member | Description |
| --- | --- |
| `sync(liveProp)` | Make subscriptions match `page.props._live`: join new channels, leave removed ones, raise cursors. Safe to call repeatedly. Accepts `undefined`/`null` (leaves everything) |
| `afterReload(liveProp)` | Raise cursors from a fresh `_live` and mark the client synced |
| `pause()` | Hold reloads and cancel the pending timer. Signals still queue. Counted; returns a function that releases this pause (once) |
| `resume()` | Release one pause; schedules a reload once none remain and something queued |
| `resetPause()` | Release every pause. The adapters call it on navigation |
| `refresh()` | Reload every bound prop now, clearing the queue. Returns a promise |
| `destroy()` | Leave all channels, clear timers and listeners. The client is unusable afterwards |
| `status` | `'connecting' \| 'live' \| 'reconnecting' \| 'offline'` |
| `lastSyncedAt` | `Date` of the last finished reload or `afterReload`, else `null` |
| `onStatus(listener)` | Subscribe to status changes; returns an unsubscribe function |
| `onSynced(listener)` | Subscribe to sync events; returns an unsubscribe function |

## What happens on a signal

1. Echo delivers `.live.changed` on `{channel}`. The leading dot is because the server uses `broadcastAs()`.
2. `CursorStore.accept(topic, version)`: stale versions (`<= cursor`) are dropped, .
3. The affected props are the signal's `props` intersected with the binding's `props`. A signal with no props means "unknown" and affects every bound prop. No affected props means no reload.
4. Affected props join a pending set and a debounce timer starts (restarted by each new signal, but never delayed past `maxWaitMs` since the first).
5. When it fires, one `reload(props)` runs with the union of pending props.
6. If more signals arrived while reloading, one follow-up reload runs after it finishes. Paused clients wait for `resume()`.
7. When a channel's subscription is confirmed (`subscribed`), the client re-reads `_live` alone. If a binding's cursor is ahead of what the client knew, a signal slipped in between render and subscribe, so that binding's props reload.

## Connection tracking

`ConnectionTracker` maps Pusher connection states to `LiveStatus`:

| Pusher state | Status |
| --- | --- |
| `connected` | `live` |
| `initialized`, `connecting` | `connecting` first time, `reconnecting` after having been live |
| `unavailable` | `reconnecting` |
| `disconnected`, `failed` | `offline` |

When status returns to `live` from `reconnecting` or `offline`, `LiveClient` calls `refresh()` once because signals may have been missed.

By default it observes `echo.connector.pusher.connection`, which exists for Reverb and Pusher. If no connection is found (other drivers), the status is assumed `live` and no reconnect reload happens. Supply your own `connection` implementing `ConnectionLike` to get one:

```ts
interface ConnectionLike {
  state?: string
  bind(event: string, callback: (payload: { current: string }) => void): unknown
  unbind(event: string, callback?: (payload: { current: string }) => void): unknown
}
```

## `CursorStore`

Exported for advanced use. `get(topic)`, `raise(topic, version)` (never backwards), `accept(topic, version)` (true and advances only if newer) and `forget(topic)`.

## Types

```ts
interface Binding { topic: string; channel: string; props: string[]; cursor: number; public?: boolean }
interface LiveProp { bindings: Binding[] }
interface ChangeSignal { topic: string; version: number; props: string[] }
type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'
type Reloader = (only: string[]) => Promise<void>
```

`EchoLike` and `EchoChannelLike` describe the subset of laravel-echo the client needs, so you can pass a real Echo instance or a stub.

## Writing a custom adapter

1. Create a `LiveClient` with a reloader that performs a partial reload with `only`.
2. Watch `page.props._live`; call `client.sync()` whenever it changes.
3. Call `client.destroy()` when the app unmounts.
4. Expose `status`, `lastSyncedAt`, `pause`, `resume` and `refresh` in whatever reactive form your framework uses.
