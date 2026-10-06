# @freepeace13/inertia-live

Client for [Inertia Live](../../docs/SPEC.md). The core (`@freepeace13/inertia-live`) is framework-agnostic; adapters live in subpaths such as `/vue`.

## Vue 3 quick start

Install once in `app.ts`; every page that carries a `_live` prop (from `Inertia::render(...)->live(...)` on the server) becomes live automatically.

```ts
import { createInertiaApp } from '@inertiajs/vue3'
import { InertiaLive } from '@freepeace13/inertia-live/vue'
import { echo } from './echo' // your configured laravel-echo instance

createInertiaApp({
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .use(InertiaLive, { echo, debounceMs: 150 })
      .mount(el)
  },
})
```

Optional status UI and manual control:

```ts
import { useLive } from '@freepeace13/inertia-live/vue'

const { status, lastSyncedAt, pause, resume, refresh } = useLive()
// status: 'connecting' | 'live' | 'reconnecting' | 'offline'
```

Call `pause()` while a user edits a form so a reload does not interrupt them; queued signals flush on `resume()`.

Testing:

```ts
import { createFakeLive } from '@freepeace13/inertia-live/vue/testing'

const fake = createFakeLive()
app.use(InertiaLive, fake.options)
fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```

## React quick start

Render `InertiaLiveProvider` inside the Inertia tree, in a persistent layout. It reads the current page with `usePage()`, so it cannot wrap `<App>` itself.

```tsx
import { InertiaLiveProvider } from '@freepeace13/inertia-live/react'
import { echo } from './echo' // your configured laravel-echo instance

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <InertiaLiveProvider echo={echo} debounceMs={150}>
      {children}
    </InertiaLiveProvider>
  )
}

// Pages: Show.layout = (page) => <AppLayout>{page}</AppLayout>
```

Status UI and manual control:

```tsx
import { useLive } from '@freepeace13/inertia-live/react'

const { status, lastSyncedAt, pause, resume, refresh } = useLive()
```

Testing:

```tsx
import { createFakeLive } from '@freepeace13/inertia-live/react/testing'

const fake = createFakeLive()
render(<InertiaLiveProvider {...fake.providerProps}>{children}</InertiaLiveProvider>)
fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```

## Framework-agnostic usage

```ts
import { LiveClient } from '@freepeace13/inertia-live'

const client = new LiveClient({
  echo, // your configured laravel-echo instance
  reload: (only) => reloadPage({ only }), // resolve when the reload finished
  debounceMs: 150,
})

client.sync(page.props._live) // on every navigation
client.afterReload(page.props._live) // after every reload
client.pause() // while a form is being edited
client.resume()
```

## Testing

```ts
import { createFakeLive } from '@freepeace13/inertia-live/testing'

const fake = createFakeLive()
const client = new LiveClient({ echo: fake.echo, reload: fake.reload })
client.sync({ bindings: [{ topic: 'documents.a', channel: 'live.documents.a', props: ['document'], cursor: 0 }] })

fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```
