# Consistency model

The guarantee: a page never ends up older than the last change signal it received, and never silently misses a change.

## Versions and cursors

- **Version**: a per-topic sequence number. `ChangeFlusher` takes the topic's next number every time it flushes a change, so each signal is strictly newer than the one before.
- **Cursor**: the latest number issued for a topic. The server stores it; each page render includes it in `_live.bindings[].cursor`; the client keeps its own copy per topic.
- **Rule**: the client drops any signal with `version <= cursor`, otherwise it accepts it and advances the cursor. A page rendered after a signal started therefore ignores that signal; a page rendered before it accepts it.

The version is *not* the stored event id. That original model dropped signals when two projectors handled the same topic; see [Design decisions](design-decisions.md#1-signal-versions-are-a-per-topic-sequence-not-event-ids) for the reasoning and the costs.

### Cursor storage

`CursorRepository` has two methods: `get(topic): int` (0 when unknown) and `next(topic): int`, which atomically issues the next number. The default `CacheCursorRepository` keeps the counter under `inertia-live:cursor:{topic}`. Choose the cache store with `cursor_store` ([Configuration](configuration.md)).

- The store must support atomic `increment`: use Redis, a database or Memcached. `array` is fine for tests and a single process. The `file` store is not atomic, so concurrent workers can issue duplicate numbers and lose a signal. A store without increment makes `next()` throw.
- A new counter starts at the current time in microseconds (about `1.8e15`), not 0. After a cache flush or a `cursor_ttl` expiry it restarts above every earlier number, so open pages keep accepting signals.
- Numbers are opaque. They do not map to `stored_events.id` and are not comparable across topics.

Bind your own `CursorRepository` to change storage. It must never issue the same number twice and must stay above every number it issued before, even after losing its data.

## Rules at a glance

| Risk | Rule |
| --- | --- |
| Signal before data is committed | Flushed in `DB::afterCommit`, after the projector handler returns |
| Several projectors, queued projectors, concurrent workers | Every flush takes a newer sequence number, so no signal is dropped as stale |
| Page renders between projection and signal | The number is issued after commit; a page that renders later holds it as its cursor and drops that signal |
| Out-of-order delivery | The client keeps the max version per topic |
| Event bursts | `ChangeBuffer` coalesces to one signal per topic per request or job; the client debounces across topics into one reload |
| WebSocket disconnect | On reconnect after `reconnecting` or `offline`, the client reloads every bound prop once |
| Sender's own action | The Vue and React adapters add `X-Socket-ID` (from `echo.socketId()`) to every Inertia visit, and the server skips that socket |
| Projector replay | Signals suppressed; optional single final signal per topic; it takes a newer sequence number, so open pages reload |
| Rate limit | Excess signals collapse into one trailing signal at the end of the window |
| Rolled-back transaction | Changes recorded inside it are discarded; no signal, no cursor update |
| Pause | Counted per `useLive()` consumer, released on unmount and on navigation; a reconnect while paused queues the reload |
| Signal for a prop the page does not show | Cursor advances, no reload |
| Signal arrives mid-reload | Props are queued and one follow-up reload runs when the current one ends |
| Reload fails | `onError` is called; the props are re-queued and retried with backoff, up to 5 times |
| Steady signal stream | Debounce is capped by `maxWaitMs`, so a reload still runs |
| Change between render and subscribe | On subscription the client re-reads `_live`; a newer cursor reloads the bound props |

## Known limits

- **The cursor store must support atomic increment** (Redis, database, Memcached). With the `file` store, concurrent workers can issue the same number and a signal is dropped. See [Design decisions](design-decisions.md#costs).
- **Versions are opaque.** They are large clock-seeded numbers, not event ids, and a topic must not be signalled more than a million times a second.
- **Cursor read after props.** A change that commits and flushes between a render reading its props and reading its cursor is missed by that page until the next signal. The window is small.
- **The trailing signal needs a queue worker** (or the `sync` driver) to fire after a burst.
- **Event store on a non-default connection:** rollback tracking and `afterCommit` follow the default connection only.
- **Reconnect and octane:** the Octane flush hook is untested.
- **Failed reloads stop retrying after 5 attempts.** Use `refresh()` or the next signal to recover. The default reloader rejects only when Inertia reports `onError`.
- **Missed signals while offline** are covered by the reconnect reload, but only for connection states reported by a Pusher-protocol connection (Reverb, Pusher). For other Echo drivers pass a `connection` ([Client core](client-core.md#connection-tracking)).
