# Projectors and the signal path

Signals are emitted from **projectors**, after the read model has been written. That guarantees the client's refetch sees the new data, including when projectors are queued.

## `EmitsLiveChanges`

```php
use Freepeace13\InertiaLive\Concerns\EmitsLiveChanges;
use Spatie\EventSourcing\EventHandlers\Projectors\Projector;

final class DocumentProjector extends Projector
{
    use EmitsLiveChanges;

    public function onDocumentRenamed(DocumentRenamed $event): void
    {
        DocumentReadModel::whereUuid($event->documentUuid)->update(['title' => $event->title]);
    }
}
```

The trait overrides Spatie's `handle(StoredEvent)`:

1. Remembers `$storedEvent->id` as the **version** being applied.
2. Calls `parent::handle()`, which runs your handler methods.
3. Resolves the event's `#[LiveTopic]` attributes and records one change per topic with that version.
4. Clears the remembered version in a `finally` block.

If the handler throws, nothing is recorded. The trait must be used on a class extending `Projector`.

Because the version is the id of the event the projector *just applied*, a queued projector that lags behind the event store still reports the correct version.

## `ChangeBuffer`

Changes go into a per-process singleton, `ChangeBuffer`, rather than being sent immediately.

### Coalescing

Changes are coalesced by topic: the highest version wins, props are unioned and `public` is OR-ed. Fifty events on one document in one command produce a single signal.

## Flushing

`ChangeFlusher` drains the buffer and broadcasts. It runs at:

| Flush point | When |
| --- | --- |
| Application terminating | End of every HTTP request and Artisan command |
| `JobProcessed` | After each queue job succeeds |
| `JobFailed` | After each queue job fails |
| `FinishedEventReplay` | After a projector replay (see below) |

The actual broadcast is wrapped in `DB::afterCommit`, so a signal is never sent for data inside an uncommitted transaction.

For each change the flusher:

1. **Records the cursor** (`CursorRepository::put`) so fresh page renders know what the read model contains. This always happens, even if the signal is later dropped.
2. **Checks authorization.** A private topic with no registered authorizer is not sent; a warning is logged (fail closed).
3. **Applies the rate limit** (`max_signals_per_second` per topic). A dropped signal is logged and not retried.
4. **Logs** the signal when `inertia-live.debug` is on.
5. **Dispatches** `LiveChangeBroadcast`.

### The broadcast

`LiveChangeBroadcast` implements `ShouldBroadcastNow` (no queue hop), is named `live.changed` and is sent on `{prefix}.{topic}`: a `PrivateChannel` normally, a public `Channel` when the topic is public. The payload is only:

```json
{ "topic": "documents.9f1c…", "version": 4127, "props": ["document", "activity"] }
```

It calls `dontBroadcastToCurrentUser()`, so the socket identified by the request's `X-Socket-ID` header is skipped. The sender already receives fresh props from their own Inertia response. If your HTTP client does not send `X-Socket-ID`, the sender simply also receives the signal and does one extra reload.

## Replays

During `php artisan event-sourcing:replay`, every historical event passes through your projectors. By default signals are suppressed while `Projectionist::isReplaying()` is true.

```php
'replay' => ['suppress' => true, 'final_signal' => false],
```

| `suppress` | `final_signal` | Behaviour |
| --- | --- | --- |
| `true` | `false` | No signals during or after replay |
| `true` | `true` | Changes are held in `ReplayBuffer`; on `FinishedEventReplay` they are coalesced and flushed, giving one final signal per touched topic |
| `false` | any | Replay behaves like normal handling (one signal per topic per flush) |

## Disabling

Set `INERTIA_LIVE_ENABLED=false` to stop recording changes entirely (`liveChanged()` and the trait's automatic path both become no-ops). Pages still render; `->live()` bindings are still emitted.
