# Consistency model

The guarantee: a page never ends up older than the last change signal it received, and never silently misses a change.

## Versions and cursors

- **Version**: the id of the stored event a projector just applied.
- **Cursor**: the last version applied to a topic's read model. The server stores it; each page render includes it in `_live.bindings[].cursor`; the client keeps its own copy per topic.
- **Rule**: the client drops any signal with `version <= cursor`, otherwise it accepts it and advances the cursor.

### Why the cursor is not `max(id)` of `stored_events`

Reading the latest event id at render time would include events a queued projector has not applied yet. When that event's signal arrived it would look stale and be dropped, leaving the page out of date. Instead, `ChangeFlusher` writes the cursor at flush time, tied to what the read model actually contains.

### Cursor storage

`CursorRepository` has two methods: `get(topic): int` (0 when unknown) and `put(topic, version)`, which never moves a cursor backwards. The default `CacheCursorRepository` stores values forever under `inertia-live:cursor:{topic}`, using an atomic lock when the cache store supports locks. Choose the cache store with `cursor_store` ([Configuration](configuration.md)). Use a shared store (Redis, database) in multi-server setups, not `array` or `file` on separate machines.

Bind your own `CursorRepository` implementation in the container to change storage.

If the cursor is lost (cache flush), it falls back to 0. That only causes harmless extra reloads.

## Rules at a glance

| Risk | Rule |
| --- | --- |
| Signal before data is committed | Flushed in `DB::afterCommit`, after the projector handler returns |
| Queued projectors lag | Version is the event id the projector just applied |
| Page renders between projection and signal | Cursor is written at flush; the client drops signals at or below it |
| Out-of-order delivery | The client keeps the max version per topic |
| Event bursts | `ChangeBuffer` coalesces to one signal per topic per request or job; the client debounces across topics into one reload |
| WebSocket disconnect | On reconnect after `reconnecting` or `offline`, the client reloads every bound prop once |
| Sender's own action | Sender's socket excluded via `X-Socket-ID` |
| Projector replay | Signals suppressed; optional single final signal per topic |
| Signal for a prop the page does not show | Cursor advances, no reload |
| Signal arrives mid-reload | Props are queued and one follow-up reload runs when the current one ends |
| Reload fails | `onError` is called; the queued props are not retried |

## Known limits

- **Rate limit drops are not retried.** When `max_signals_per_second` drops a signal, an already-open page can stay stale until the next change. The cursor still advances, so *fresh* renders are correct.
- **Failed reloads are not retried.** Use `refresh()` or the next signal to recover.
- **Missed signals while offline** are covered by the reconnect reload, but only for connection states reported by a Pusher-protocol connection (Reverb, Pusher). For other Echo drivers pass a `connection` ([Client core](client-core.md#connection-tracking)).
