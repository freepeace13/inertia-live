# Design decisions

## 1. Signal versions are a per-topic sequence, not event ids

**Status:** accepted. Replaces the original "version is the stored event id" model.

### Context

A signal carries a `version`, and each page holds a `cursor` per topic. The client drops any signal whose version is at or below its cursor. Originally the version was the id of the stored event the projector had just applied, and the cursor was the highest such id seen for the topic.

That breaks when more than one projector handles events for the same topic. A sync projector and a queued projector both handle event 100 for `documents.abc`. The first to flush advances the cursor to 100; the second signal also says 100 and is dropped as stale, although it announces a different read model. Concurrent queue workers finishing out of order fail the same way: the lower id arrives after the higher one and looks stale.

### Options considered

| | A: version per (topic, projector) | B: per-topic sequence taken at flush (chosen) |
| --- | --- | --- |
| Signal contract | Adds a projector id; cursors become a map | Unchanged: `{ topic, version, props }` |
| `_live` shape | Bindings must name the projector they follow | Unchanged |
| Client | Per-(topic, projector) cursors | No change |
| API surface | New `projector:` argument on `->live()` | None |
| Event id needed | Yes, must be an integer | No |
| Replay final signal | Needs a `force` flag | Works as is: it takes a newer sequence number |

### Decision

`ChangeFlusher` calls `CursorRepository::next($topic)` for every change, after the transaction commits and before the rate limiter. The result is the signal's `version` and the topic's cursor. Every signal is therefore strictly newer than the one before, whichever projector or worker produced it, and no signal is dropped as stale.

Why this is safe with out-of-order delivery: a number is issued only after its transaction committed. If a client receives a higher number first, its reload happens after the lower number's commit, so the lower signal's data is already in what it fetches.

The counter is seeded from the clock (microseconds since the epoch) when it is created, not from 0. If the cache is flushed or a key expires, the counter restarts above everything issued before, so clients holding an old cursor still accept new signals.

### Costs

- **Atomic increment is required.** The cursor store must support atomic `increment`: Redis, database, Memcached and `array` do. The `file` store does not, so concurrent workers could issue the same number and one signal would be dropped. A store that cannot increment makes `next()` throw. Use a shared store in multi-server setups, as before.
- **The version no longer identifies an event.** It is an opaque, increasing number. Logs and the payload cannot be correlated with `stored_events.id`; the debug log shows the topic, version and props only. If you need to trace a signal to an event, log it from your projector.
- **Versions are large.** Values are around `1.8e15`. They are safe integers in PHP and JavaScript (until about the year 2255), but they look odd in dashboards, and they are not comparable across topics.
- **A topic must not be signalled faster than a million times per second.** The clock seed only guarantees monotonic restarts under that rate. The rate limiter does not bound counter increments (every change takes a number), so this is a property of your workload; no realistic one comes near it.
- **Cache loss restarts the counter high, not at 0.** That keeps clients safe, but a cache flush now means "the next number is the current time" rather than "cursor 0". Cursors that expire (`cursor_ttl`) behave the same way, and are safe.
- **Every flushed change costs one cache write.** Before this was a read plus a conditional write under a lock. The lock is gone.
- **Redundant reloads are possible.** Two projectors signalling one topic now produce two signals and so up to two reloads, where the old model collapsed them (wrongly). The client debounce merges signals that arrive close together.
- **Breaking, pre-1.0.** `CursorRepository::put()` is replaced by `next()`. `Change` no longer carries a version, and `LiveChangeBroadcast` takes the version as its second constructor argument. The `force` flag on replay signals is gone because it is no longer needed.

### What this does not change

- Rendering still reads the cursor after the page's props. A change that commits and flushes between those two reads is covered by neither the cursor nor the props. The subscribe-time `_live` re-read does not catch it either, because the cursor it fetches already includes that change. The window is small, and the same as before this decision.
- One failed flush, rollback handling, rate-limit trailing signals and the client-side recovery paths are unaffected.
