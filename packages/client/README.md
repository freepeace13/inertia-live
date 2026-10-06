# @freepeace13/inertia-live

Client for [Inertia Live](../../docs/SPEC.md). The core (`@freepeace13/inertia-live`) is framework-agnostic; adapters live in subpaths such as `/vue`.

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
