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

1. Marks that a stored event is being handled.
2. Calls `parent::handle()`, which runs your handler methods.
3. Resolves the event's `#[LiveTopic]` attributes and records one change per topic.
4. Clears the mark in a `finally` block.

If the handler throws, nothing is recorded. The trait must be used on a class extending `Projector`.

The change carries no version. The flusher issues the topic's next sequence number when it broadcasts, after the commit, so a queued projector that lags behind the event store, or several projectors on one topic, each produce a newer signal and none is dropped as stale. See [Design decisions](design-decisions.md#1-signal-versions-are-a-per-topic-sequence-not-event-ids).

## `ChangeBuffer`

Changes go into a per-process singleton, `ChangeBuffer`, rather than being sent immediately.

### Coalescing

Changes are coalesced by topic: props are unioned. Fifty events on one document in one command produce a single signal.

## Flushing

`ChangeFlusher` drains the buffer and broadcasts. It runs at:

| Flush point | When |
| --- | --- |
| Application terminating | End of every HTTP request and Artisan command |
| `JobProcessed` | After each queue job succeeds |
| `JobFailed` | After each queue job fails |
| `FinishedEventReplay` | After a projector replay (see below) |

The actual broadcast is wrapped in `DB::afterCommit`, so a signal is never sent for data inside an uncommitted transaction. Changes remember the transaction level they were recorded at: if that transaction rolls back (even while the request carries on), they are discarded and no signal or cursor update happens.

A failure while flushing one topic (a cache lock timeout, an unreachable broadcaster) is logged and the remaining topics still flush.

For each change the flusher:

1. **Takes the next sequence number** (`CursorRepository::next`). It becomes the signal's version and the topic's cursor, so fresh page renders start from it. This always happens, even if the signal is later rate limited.
2. **Checks authorization.** A private topic with no registered authorizer is not sent; a warning is logged (fail closed).
3. **Applies the rate limit** (`max_signals_per_second` per topic). Signals over the limit are not dropped: the first one queues a `SendTrailingSignal` job for when the window ends, which announces the topic's latest cursor with no prop list (clients reload everything bound). This needs a queue worker; with the `sync` driver it runs immediately.
4. **Logs** the signal when `inertia-live.debug` is on.
5. **Dispatches** `LiveChangeBroadcast`.

### The broadcast

`LiveChangeBroadcast` implements `ShouldBroadcastNow` (no queue hop), is named `live.changed` and is sent on `{prefix}.{topic}`: a `PrivateChannel` normally, a public `Channel` when the topic is public. The payload is only:

```json
{ "topic": "documents.9f1c…", "version": 1791297784442001, "props": ["document", "activity"] }
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
