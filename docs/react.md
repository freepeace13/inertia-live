# React

Requires `react` 18 or 19, `@inertiajs/react` ^2 or ^3 and `laravel-echo` ^2.

## Add the provider

`InertiaLiveProvider` reads the current page with `usePage()`, which only works inside Inertia's component tree. Render it in a **persistent layout**, not around `<App>`.

```tsx
import { InertiaLiveProvider } from '@freepeace13/inertia-live/react'
import { echo } from './echo'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <InertiaLiveProvider echo={echo} debounceMs={150}>
      {children}
    </InertiaLiveProvider>
  )
}

// Pages: Show.layout = (page) => <AppLayout>{page}</AppLayout>
```

A non-persistent layout still works but recreates the client on every navigation. Keep `echo` a stable reference (module-level), since a new `echo` or `debounceMs` or `connection` recreates the client.

### Props

| Prop | Default | Description |
| --- | --- | --- |
| `echo` | required | Your laravel-echo instance |
| `debounceMs` | `150` | Debounce window; `0` reloads immediately |
| `maxWaitMs` | `debounceMs * 4` | Longest a steady signal stream can postpone a reload |
| `connection` | Pusher connection | Override connection observation for other drivers |
| `reload` | `router.reload` based | Replace the reloader (mainly for tests) |
| `onError` | none | Called when a live reload fails |
| `children` | none | The wrapped tree |

`reload` and `onError` may change identity every render; the provider keeps the latest in a ref and never recreates the client for them.

### Lifecycle

- The client is created in an effect and destroyed on cleanup, so React StrictMode's mount, unmount, mount cycle neither leaks subscriptions nor sends duplicate reloads.
- `usePage().props._live` is watched in an effect, calling `client.sync()` on each navigation and reload.
- Before the client exists (first render, SSR) `useLive()` reports `status: 'connecting'` and no-op controls.

## `useLive()`

```tsx
import { useLive } from '@freepeace13/inertia-live/react'

function LiveBadge() {
  const { status, lastSyncedAt, pause, resume, refresh } = useLive()

  return (
    <>
      <span data-status={status}>{status}</span>
      {lastSyncedAt && <small>Synced {lastSyncedAt.toLocaleTimeString()}</small>}
      <button onClick={() => refresh()}>Refresh</button>
      <input onFocus={pause} onBlur={resume} />
    </>
  )
}
```

| Member | Type |
| --- | --- |
| `status` | `'connecting' \| 'live' \| 'reconnecting' \| 'offline'` |
| `lastSyncedAt` | `Date \| null` |
| `pause()` | Hold reloads; signals keep queueing. Scoped to this component: released on unmount and on navigation |
| `resume()` | Release this component's latest pause and flush anything queued |
| `refresh()` | Reload every live prop now; returns a promise |

State is built on `useSyncExternalStore`. `useLive()` throws if used outside `<InertiaLiveProvider>`.

## Testing

```tsx
import { createFakeLive } from '@freepeace13/inertia-live/react/testing'

const fake = createFakeLive({ debounceMs: 0 })
render(<InertiaLiveProvider {...fake.providerProps}>{children}</InertiaLiveProvider>)

fake.emit('documents.a', 1, ['document'])
// fake.reloads === [['document']]
```

See [Testing](testing.md) for the full fake API.
