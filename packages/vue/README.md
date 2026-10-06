# @freepeace13/inertia-live-vue

Vue 3 adapter for [Inertia Live](https://github.com/freepeace13/inertia-live): install one plugin and every page that carries a `_live` prop becomes live.

The socket only carries a tiny "topic changed" signal. The client reloads the affected props through the page's own controller, so policies, hidden attributes and per-user fields keep working unchanged. Pair it with the server package, [`freepeace13/inertia-live-laravel`](https://github.com/freepeace13/inertia-live-laravel).

## Part of Inertia Live

| Package | Install | Role |
| --- | --- | --- |
| [`freepeace13/inertia-live-laravel`](https://github.com/freepeace13/inertia-live-laravel) | `composer require freepeace13/inertia-live-laravel` | Server: topics, projector trait, broadcasting, `->live()` |
| [`@freepeace13/inertia-live-core`](https://github.com/freepeace13/inertia-live/tree/main/packages/core) | `npm install @freepeace13/inertia-live-core` | Framework-agnostic client |
| **`@freepeace13/inertia-live-vue`** (this package) | `npm install @freepeace13/inertia-live-vue` | Vue 3 plugin and `useLive()` |
| [`@freepeace13/inertia-live-react`](https://github.com/freepeace13/inertia-live/tree/main/packages/react) | `npm install @freepeace13/inertia-live-react` | React provider and `useLive()` |

Full documentation and a runnable demo live in the [docs](https://github.com/freepeace13/inertia-live-docs) and [demo](https://github.com/freepeace13/inertia-live-demo) repositories.

## Requirements

- Vue 3.4+ and `@inertiajs/vue3` ^2.0 or ^3.0
- `laravel-echo` ^2.0 with an Echo-compatible broadcaster

## Installation

```bash
npm install @freepeace13/inertia-live-vue laravel-echo
```

`@freepeace13/inertia-live-core` is installed as a dependency.

## Usage

Install once in `app.ts`:

```ts
import { createInertiaApp } from '@inertiajs/vue3'
import { InertiaLive } from '@freepeace13/inertia-live-vue'
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
import { useLive } from '@freepeace13/inertia-live-vue'

const { status, lastSyncedAt, stale, pause, resume, refresh } = useLive()
// status: 'connecting' | 'live' | 'reconnecting' | 'offline'
```

`stale` is a ref that turns true when reloads gave up after repeated failures (the page may show outdated data) and clears on the next successful reload. Use it to show a "data may be out of date" banner with a `refresh()` button.

Call `pause()` while a user edits a form so a reload does not interrupt them; queued signals flush on `resume()`.

## Server-side rendering

During SSR the plugin is inert: it opens no channels and registers no router listeners, and `useLive()` returns a client that reports `connecting`. Live behavior starts in the browser.

## Testing

```ts
import { createFakeLive } from '@freepeace13/inertia-live-vue/testing'

const fake = createFakeLive()
app.use(InertiaLive, fake.options)
fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```

## Documentation

[Vue 3](https://github.com/freepeace13/inertia-live-docs/blob/main/vue.md), [Testing](https://github.com/freepeace13/inertia-live-docs/blob/main/testing.md) and the [documentation index](https://github.com/freepeace13/inertia-live-docs/blob/main/README.md).

## Development

From the repository root:

```bash
pnpm install
pnpm build           # core first, then the adapters
pnpm test
pnpm typecheck
pnpm lint            # Biome (pnpm format to fix)
```

## License

MIT
