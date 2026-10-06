# @freepeace13/inertia-live-react

React adapter for [Inertia Live](https://github.com/freepeace13/inertia-live): render one provider in a persistent layout and every page that carries a `_live` prop becomes live.

The socket only carries a tiny "topic changed" signal. The client reloads the affected props through the page's own controller, so policies, hidden attributes and per-user fields keep working unchanged. Pair it with the server package, [`freepeace13/inertia-live-laravel`](https://github.com/freepeace13/inertia-live-laravel).

## Part of Inertia Live

| Package | Install | Role |
| --- | --- | --- |
| [`freepeace13/inertia-live-laravel`](https://github.com/freepeace13/inertia-live-laravel) | `composer require freepeace13/inertia-live-laravel` | Server: topics, projector trait, broadcasting, `->live()` |
| [`@freepeace13/inertia-live-core`](https://github.com/freepeace13/inertia-live/tree/main/packages/core) | `npm install @freepeace13/inertia-live-core` | Framework-agnostic client |
| [`@freepeace13/inertia-live-vue`](https://github.com/freepeace13/inertia-live/tree/main/packages/vue) | `npm install @freepeace13/inertia-live-vue` | Vue 3 plugin and `useLive()` |
| **`@freepeace13/inertia-live-react`** (this package) | `npm install @freepeace13/inertia-live-react` | React provider and `useLive()` |

Full documentation and a runnable demo live in the [docs](https://github.com/freepeace13/inertia-live-docs) and [demo](https://github.com/freepeace13/inertia-live-demo) repositories.

## Requirements

- React 18 or 19 and `@inertiajs/react` ^2.0 or ^3.0 (Inertia 3 needs React 19)
- `laravel-echo` ^2.0 with an Echo-compatible broadcaster

## Installation

```bash
npm install @freepeace13/inertia-live-react laravel-echo
```

`@freepeace13/inertia-live-core` is installed as a dependency.

## Usage

Render `InertiaLiveProvider` inside the Inertia tree, in a persistent layout. It reads the current page with `usePage()`, so it cannot wrap `<App>` itself.

```tsx
import { InertiaLiveProvider } from '@freepeace13/inertia-live-react'
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
import { useLive } from '@freepeace13/inertia-live-react'

const { status, lastSyncedAt, pause, resume, refresh } = useLive()
// status: 'connecting' | 'live' | 'reconnecting' | 'offline'
```

Call `pause()` while a user edits a form so a reload does not interrupt them; queued signals flush on `resume()`.

## Testing

```tsx
import { createFakeLive } from '@freepeace13/inertia-live-react/testing'

const fake = createFakeLive()
render(<InertiaLiveProvider {...fake.providerProps}>{children}</InertiaLiveProvider>)
fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```

## Documentation

[React](https://github.com/freepeace13/inertia-live-docs/blob/main/react.md), [Testing](https://github.com/freepeace13/inertia-live-docs/blob/main/testing.md) and the [documentation index](https://github.com/freepeace13/inertia-live-docs/blob/main/README.md).

## Development

From the repository root:

```bash
npm install
npm run build       # core first, then the adapters
npm test
npm run typecheck
npm run lint        # Biome (npm run format to fix)
```

## License

MIT
