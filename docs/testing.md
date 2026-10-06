# Testing

## PHP: `Live::fake()`

`Live::fake()` replaces the flusher with a recorder, so changes are captured instead of broadcast. Nothing touches the cursor store, rate limiter or broadcaster.

```php
use Freepeace13\InertiaLive\Facades\Live;

it('signals the document topic once', function () {
    Live::fake();

    $this->post(route('documents.rename', $doc), ['title' => 'Q4 plan']);

    Live::assertChanged("documents.{$doc->uuid}", props: ['document']);
    Live::assertNothingChangedFor('documents.other-uuid');
    Live::assertChangedTimes("documents.{$doc->uuid}", 1);
});
```

| Assertion | Passes when |
| --- | --- |
| `assertChanged($topic, ?array $props = null)` | At least one flushed change for the topic exists and, if `$props` is given, one of them includes all of those props |
| `assertNothingChangedFor($topic)` | No flushed change for the topic |
| `assertChangedTimes($topic, $times)` | Exactly `$times` flushed changes for the topic. Proves coalescing: one request with many events should be `1` |

A change is "flushed" when the request, job or command ends (or when the flusher is called). In feature tests that is the end of the simulated request.

`Live::authorize()`, `Live::publicTopic()` and `Live::hasAuthorizerFor()` still delegate to the real manager under the fake. `Live::fake()` can be called repeatedly and does not rebind `LiveManager`, so resolving `ChangeFlusher` or `LiveManager` afterwards still returns the real classes.

### Testing without the fake

For lower-level tests, resolve `ChangeBuffer`, `TopicResolver`, `ChangeFlusher` or `CursorRepository` from the container. The package's own suite uses Pest with Orchestra Testbench, SQLite in memory and Spatie's migrations; fixtures live in `packages/laravel/tests/Fixtures`.

## Client: `createFakeLive()`

Every adapter has a `createFakeLive()` that returns a fake Echo plus helpers to drive it.

| Import | Extra member for wiring |
| --- | --- |
| `@freepeace13/inertia-live/testing` | `echo`, `reload` for `new LiveClient({...})` |
| `@freepeace13/inertia-live/vue/testing` | `options` for `app.use(InertiaLive, fake.options)` |
| `@freepeace13/inertia-live/react/testing` | `providerProps` for `<InertiaLiveProvider {...fake.providerProps}>` |

The Vue and React versions also accept `{ debounceMs }`. All accept `{ channelPrefix }` (default `'live'`).

### Fake API

| Member | Description |
| --- | --- |
| `echo` | Fake Echo implementing `private`, `channel`, `leave` and a Pusher-like connection |
| `reload` | Reloader that records the call |
| `reloads` | `string[][]`: every `only` list passed to the reloader, in order |
| `joined` | `Set<string>` of channels currently joined |
| `left` | Channels left, in order |
| `emit(topic, version, props = [])` | Deliver a change signal as if broadcast on `{prefix}.{topic}` |
| `setSocketId(id)` | What `echo.socketId()` reports, for sender-exclusion tests |
| `confirmSubscription(topic)` | Simulate the server confirming the subscription (triggers the missed-signal check) |
| `setConnectionState(state)` | Simulate `connected`, `connecting`, `unavailable`, `disconnected`, `failed` |

### Example (core)

```ts
import { LiveClient } from '@freepeace13/inertia-live'
import { createFakeLive } from '@freepeace13/inertia-live/testing'

const fake = createFakeLive()
const client = new LiveClient({ echo: fake.echo, reload: fake.reload, debounceMs: 0 })

client.sync({
  bindings: [{ topic: 'documents.a', channel: 'live.documents.a', props: ['document'], cursor: 0 }],
})

fake.emit('documents.a', 1)
expect(fake.reloads).toEqual([['document']])

fake.emit('documents.a', 1) // stale: version <= cursor
expect(fake.reloads).toHaveLength(1)
```

Use `debounceMs: 0` for immediate reloads, or wait past the debounce window (150 ms by default) before asserting.

### Testing reconnects

```ts
fake.setConnectionState('unavailable')
fake.setConnectionState('connected') // triggers one refresh() of all bound props
```

## Running the repository's own tests

```bash
# server
cd packages/laravel && composer install && composer test   # also: composer lint, composer analyse

# client
cd packages/client && npm ci && npm test                   # also: npm run typecheck, npm run lint
```
