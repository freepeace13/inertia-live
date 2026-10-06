# Inertia Live

Live Inertia pages driven by [Spatie Event Sourcing](https://github.com/spatie/laravel-event-sourcing) projections. Declare once on the server which projection changes affect which page props; the package handles broadcasting, subscribing, ordering and reloading. No per-page WebSocket code.

The socket only carries a tiny "topic changed" signal. The page re-fetches the affected props through its own controller, so policies, hidden attributes and per-user fields keep working unchanged.

- Composer: `freepeace13/inertia-live-projections` (`packages/laravel`)
- npm: `@freepeace13/inertia-live` (`packages/client`, Vue 3 and React)
- Design: [docs/SPEC.md](docs/SPEC.md)

Requires PHP 8.3+, Laravel 12/13, Inertia 2/3, `spatie/laravel-event-sourcing` ^7.14 and any Echo-compatible broadcaster (Reverb, Pusher, Ably).

## Quick start (5 minutes)

### 1. Declare topics on events

```php
use Freepeace13\InertiaLive\Attributes\LiveTopic;

#[LiveTopic('documents.{documentUuid}', props: ['document', 'activity'])]
final class DocumentRenamed extends ShouldBeStored
{
    public function __construct(
        public readonly string $documentUuid,
        public readonly string $title,
    ) {}
}
```

### 2. Mark changes in projectors

```php
use Freepeace13\InertiaLive\Concerns\EmitsLiveChanges;

final class DocumentProjector extends Projector
{
    use EmitsLiveChanges; // signals are sent after the handler returns and the transaction commits

    public function onDocumentRenamed(DocumentRenamed $event): void
    {
        DocumentReadModel::whereUuid($event->documentUuid)->update(['title' => $event->title]);
    }
}
```

For events without the attribute, call `$this->liveChanged('documents.'.$uuid, ['document'])`.

### 3. Authorize the topic

```php
use Freepeace13\InertiaLive\Facades\Live;

Live::authorize('documents.{uuid}', fn (User $user, string $uuid) =>
    $user->can('view', Document::whereUuid($uuid)->firstOrFail())
);
```

Private topics without an authorizer fail closed.

### 4. Bind the topic to props in the controller

```php
return Inertia::render('Documents/Show', [
    'document' => DocumentResource::make($doc),
    'activity' => fn () => $doc->activity()->latest()->limit(20)->get(),
])->live("documents.{$doc->uuid}", only: ['document', 'activity']);
```

### 5. Install the client

Vue 3:

```ts
import { InertiaLive } from '@freepeace13/inertia-live/vue'

createApp({ render: () => h(App, props) })
  .use(plugin)
  .use(InertiaLive, { echo, debounceMs: 150 })
  .mount(el)
```

React, in a persistent layout (the provider reads `usePage()`, so it must render inside the Inertia tree):

```tsx
import { InertiaLiveProvider } from '@freepeace13/inertia-live/react'

export default function AppLayout({ children }) {
  return <InertiaLiveProvider echo={echo}>{children}</InertiaLiveProvider>
}
```

Both expose `useLive()` for `{ status, lastSyncedAt, pause, resume, refresh }`. Call `pause()` while a user edits a form so a reload does not interrupt them.

## Guarantees

| Risk | Rule |
| --- | --- |
| Signal before data is committed | Flushed only after the DB commit and after the projector handler returns |
| Queued projectors lag | Version is the stored event id the projector just applied |
| Render races a signal | Cursor is the last applied version; the client drops signals at or below it |
| Out-of-order delivery | The client keeps the max version per topic |
| Event bursts | One signal per topic per request or job; one debounced reload |
| WebSocket disconnect | One full reload of bound props on reconnect |
| Sender's own action | The sender's socket is excluded (`X-Socket-ID`) |
| Projector replay | Signals suppressed; optional one final signal per topic |

Signals are capped at `max_signals_per_second` per topic (default 10). A signal dropped by the cap is not retried, so an already-open page can stay stale until the next change; the cursor still advances, so fresh renders are correct.

## Testing

```php
Live::fake();

$this->post(route('documents.rename', $doc), ['title' => 'Q4 plan']);

Live::assertChanged("documents.{$doc->uuid}", props: ['document']);
Live::assertNothingChangedFor('documents.other-uuid');
Live::assertChangedTimes("documents.{$doc->uuid}", 1);
```

Client helpers: `createFakeLive()` from `@freepeace13/inertia-live/vue/testing` or `/react/testing`.

## Configuration

`config/inertia-live.php` has six keys: `enabled`, `channel_prefix`, `cursor_store`, `max_signals_per_second`, `replay` and `debug`. Publish with `php artisan vendor:publish --tag=inertia-live-config`.

## Repository

```
packages/laravel   composer package (Pest + Orchestra Testbench)
packages/client    npm package (Vitest): core, vue, react
demo/              Laravel 13 demo app with Vue and React frontends
```

MIT licensed.
