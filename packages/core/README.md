# @freepeace13/inertia-live-core

Framework-agnostic client for [Inertia Live](https://github.com/freepeace13/inertia-live): subscribes to topic signals over Laravel Echo and reloads the affected props. Use it directly for another framework; the Vue and React packages are thin wrappers around it.

The socket only carries a tiny "topic changed" signal. The client reloads the affected props through the page's own controller, so policies, hidden attributes and per-user fields keep working unchanged. Pair it with the server package, [`freepeace13/inertia-live-laravel`](https://github.com/freepeace13/inertia-live-laravel).

## Part of Inertia Live

| Package | Install | Role |
| --- | --- | --- |
| [`freepeace13/inertia-live-laravel`](https://github.com/freepeace13/inertia-live-laravel) | `composer require freepeace13/inertia-live-laravel` | Server: topics, projector trait, broadcasting, `->live()` |
| **`@freepeace13/inertia-live-core`** (this package) | `npm install @freepeace13/inertia-live-core` | Framework-agnostic client |
| [`@freepeace13/inertia-live-vue`](https://github.com/freepeace13/inertia-live/tree/main/packages/vue) | `npm install @freepeace13/inertia-live-vue` | Vue 3 plugin and `useLive()` |
| [`@freepeace13/inertia-live-react`](https://github.com/freepeace13/inertia-live/tree/main/packages/react) | `npm install @freepeace13/inertia-live-react` | React provider and `useLive()` |

Full documentation and a runnable demo live in the [docs](https://github.com/freepeace13/inertia-live-docs) and [demo](https://github.com/freepeace13/inertia-live-demo) repositories.

## Requirements

- `laravel-echo` ^2.0 with an Echo-compatible broadcaster (Reverb, Pusher or Ably)
- A server running `freepeace13/inertia-live-laravel`

## Installation

```bash
npm install @freepeace13/inertia-live-core laravel-echo
```

## Usage

```ts
import { LiveClient } from '@freepeace13/inertia-live-core'

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
import { LiveClient } from '@freepeace13/inertia-live-core'
import { createFakeLive } from '@freepeace13/inertia-live-core/testing'

const fake = createFakeLive()
const client = new LiveClient({ echo: fake.echo, reload: fake.reload })
client.sync({ bindings: [{ topic: 'documents.a', channel: 'live.documents.a', props: ['document'], cursor: 0 }] })

fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```

## Documentation

[Client core](https://github.com/freepeace13/inertia-live-docs/blob/main/client-core.md), [Consistency](https://github.com/freepeace13/inertia-live-docs/blob/main/consistency.md) and the [documentation index](https://github.com/freepeace13/inertia-live-docs/blob/main/README.md).

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
