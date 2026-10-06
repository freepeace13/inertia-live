# Inertia Live

Live Inertia pages driven by [Spatie Event Sourcing](https://github.com/spatie/laravel-event-sourcing) projections. Declare once on the server which projection changes affect which page props; the package handles broadcasting, subscribing, ordering and reloading. No per-page WebSocket code.

The socket only carries a tiny "topic changed" signal (`{ topic, version, props }`). The page re-fetches the affected props through its own controller, so policies, hidden attributes and per-user fields keep working unchanged.

| Package | Install | Role |
| --- | --- | --- |
| [`freepeace13/inertia-live-laravel`](https://github.com/freepeace13/inertia-live-laravel) | `composer require freepeace13/inertia-live-laravel` | Server: topics, projector trait, broadcasting, `->live()` |
| [`@freepeace13/inertia-live-core`](packages/core/README.md) | `npm install @freepeace13/inertia-live-core` | Framework-agnostic client |
| [`@freepeace13/inertia-live-vue`](packages/vue/README.md) | `npm install @freepeace13/inertia-live-vue` | Vue 3 plugin and `useLive()` |
| [`@freepeace13/inertia-live-react`](packages/react/README.md) | `npm install @freepeace13/inertia-live-react` | React provider and `useLive()` |

This repository holds the client packages. The Laravel adapter, the documentation and the demo app live in their own repositories ([inertia-live-laravel](https://github.com/freepeace13/inertia-live-laravel), [inertia-live-docs](https://github.com/freepeace13/inertia-live-docs), [inertia-live-demo](https://github.com/freepeace13/inertia-live-demo)).

Requires PHP 8.3+, Laravel 12/13, Inertia 2/3, `spatie/laravel-event-sourcing` ^7.14, an Echo-compatible broadcaster (Reverb, Pusher, Ably) and Vue 3.4+ or React 18/19. Details in [Installation](https://github.com/freepeace13/inertia-live-docs/blob/main/installation.md).

## Quick start

### 1. Declare topics on events

```php
#[LiveTopic('documents.{documentUuid}', props: ['document', 'activity'])]
final class DocumentRenamed extends ShouldBeStored
{
    public function __construct(
        public readonly string $documentUuid,
        public readonly string $title,
    ) {}
}
```

Placeholders come from the event's properties; the attribute is repeatable. See [Topics](https://github.com/freepeace13/inertia-live-docs/blob/main/topics.md).

### 2. Mark changes in projectors

```php
final class DocumentProjector extends Projector
{
    use EmitsLiveChanges;

    public function onDocumentRenamed(DocumentRenamed $event): void
    {
        DocumentReadModel::whereUuid($event->documentUuid)->update(['title' => $event->title]);
    }
}
```

Signals go out after the handler returns and the transaction commits. For events without the attribute, call `$this->liveChanged(...)`. See [Projectors](https://github.com/freepeace13/inertia-live-docs/blob/main/projectors.md).

### 3. Authorize the topic

```php
Live::authorize('documents.{uuid}', fn (User $user, string $uuid) =>
    $user->can('view', Document::whereUuid($uuid)->firstOrFail())
);
```

Private topics without an authorizer fail closed. See [Authorization](https://github.com/freepeace13/inertia-live-docs/blob/main/authorization.md).

### 4. Bind the topic to props

```php
return Inertia::render('Documents/Show', [
    'document' => DocumentResource::make($doc),
    'activity' => fn () => $doc->activity()->latest()->limit(20)->get(),
])->live("documents.{$doc->uuid}", only: ['document', 'activity']);
```

See [Page bindings](https://github.com/freepeace13/inertia-live-docs/blob/main/bindings.md).

### 5. Install the client

```bash
npm install @freepeace13/inertia-live-vue laravel-echo     # or @freepeace13/inertia-live-react
```

Vue 3:

```ts
createApp({ render: () => h(App, props) })
  .use(plugin)
  .use(InertiaLive, { echo, debounceMs: 150 })
  .mount(el)
```

React, in a persistent layout (the provider reads `usePage()`):

```tsx
export default function AppLayout({ children }) {
  return <InertiaLiveProvider echo={echo}>{children}</InertiaLiveProvider>
}
```

Both expose `useLive()` for `{ status, lastSyncedAt, pause, resume, refresh }`. Call `pause()` while a user edits a form. See [Vue 3](https://github.com/freepeace13/inertia-live-docs/blob/main/vue.md), [React](https://github.com/freepeace13/inertia-live-docs/blob/main/react.md) and the [client core](https://github.com/freepeace13/inertia-live-docs/blob/main/client-core.md).

## Guarantees

| Risk | Rule |
| --- | --- |
| Signal before data is committed | Flushed after the DB commit and the projector handler |
| Queued or several projectors on a topic | Each signal takes the topic's next sequence number, so none is dropped as stale |
| Render races a signal | Client drops signals at or below the page's cursor |
| Out-of-order delivery | Client keeps the max version per topic |
| Event bursts | One signal per topic per request or job; one debounced reload |
| WebSocket disconnect | One full reload of bound props on reconnect |
| Sender's own action | Adapters send `X-Socket-ID`; the sender's socket is skipped |
| Projector replay | Signals suppressed; optional final signal per topic |
| Rate limit | Over the cap (`max_signals_per_second`, default 10) signals collapse into one trailing signal |
| Rolled-back transaction | Its changes are discarded, nothing is broadcast |

The cursor store needs atomic `increment` (Redis, database, Memcached). Full model, limits and the costs of this design: [Consistency](https://github.com/freepeace13/inertia-live-docs/blob/main/consistency.md) and [Design decisions](https://github.com/freepeace13/inertia-live-docs/blob/main/design-decisions.md).

## Testing

```php
Live::fake();

$this->post(route('documents.rename', $doc), ['title' => 'Q4 plan']);

Live::assertChanged("documents.{$doc->uuid}", props: ['document']);
Live::assertChangedTimes("documents.{$doc->uuid}", 1);
```

Client tests use `createFakeLive()` from `@freepeace13/inertia-live-vue/testing` or `/react/testing`. See [Testing](https://github.com/freepeace13/inertia-live-docs/blob/main/testing.md).

## Documentation

| Doc | Covers |
| --- | --- |
| [Installation](https://github.com/freepeace13/inertia-live-docs/blob/main/installation.md) | Requirements, packages, broadcasting and Echo setup |
| [Topics](https://github.com/freepeace13/inertia-live-docs/blob/main/topics.md) | `#[LiveTopic]`, placeholders, `liveChanged()` |
| [Projectors](https://github.com/freepeace13/inertia-live-docs/blob/main/projectors.md) | `EmitsLiveChanges`, buffering, flushing, replays |
| [Page bindings](https://github.com/freepeace13/inertia-live-docs/blob/main/bindings.md) | `->live()` and the `_live` prop |
| [Authorization](https://github.com/freepeace13/inertia-live-docs/blob/main/authorization.md) | `Live::authorize()`, private and public topics |
| [Consistency](https://github.com/freepeace13/inertia-live-docs/blob/main/consistency.md) | Versions, cursors, ordering, known limits |
| [Configuration](https://github.com/freepeace13/inertia-live-docs/blob/main/configuration.md) | Every `config/inertia-live.php` key |
| [Client core](https://github.com/freepeace13/inertia-live-docs/blob/main/client-core.md) | `LiveClient`, connection tracking, custom adapters |
| [Vue 3](https://github.com/freepeace13/inertia-live-docs/blob/main/vue.md) / [React](https://github.com/freepeace13/inertia-live-docs/blob/main/react.md) | Adapters and `useLive()` |
| [Testing](https://github.com/freepeace13/inertia-live-docs/blob/main/testing.md) | PHP and Vitest fakes |
| [Troubleshooting](https://github.com/freepeace13/inertia-live-docs/blob/main/troubleshooting.md) | Symptoms, causes, fixes |
| [Spec](https://github.com/freepeace13/inertia-live-docs/blob/main/SPEC.md) | Original design, goals and milestones |

## Repository

```
packages/core    @freepeace13/inertia-live-core   (Vitest)
packages/vue     @freepeace13/inertia-live-vue    (Vitest)
packages/react   @freepeace13/inertia-live-react  (Vitest)
```

The npm packages are workspaces: `npm install`, `npm run build` and `npm test` run from the root. The Laravel adapter is developed in [freepeace13/inertia-live-laravel](https://github.com/freepeace13/inertia-live-laravel).

MIT licensed.
