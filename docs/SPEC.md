# Inertia Live Projections — Spec & Architecture

Oct 6, 2026 · @Kin

## Overview

The package lets an Inertia page stay live: when a stored event updates a projection, every page showing that projection refreshes the affected props automatically, with no per-page WebSocket code.

**Working name:** Inertia Live Projections (`freepeace13/inertia-live-projections` on Packagist, `@freepeace13/inertia-live` on npm).

**Problem.** In a Laravel app using Spatie Event Sourcing and Inertia, making a page real-time today means hand-wiring four things per feature: a broadcast event, a channel authorization rule, an Echo listener in the Vue page, and the reload logic. That wiring is repetitive, easy to get wrong (stale data, race conditions, leaked payloads), and scattered across PHP and JS.

**Value proposition.** Declare once on the server which projection changes affect which page props. The package handles broadcasting, subscribing, ordering and reloading.

**Target users.** Laravel developers building collaborative or dashboard-style apps on Spatie Event Sourcing + Inertia (Vue 3 and React).

**Goals (v1)**

- Zero-boilerplate live props: a page opts in with one server-side call; no Echo code in the page component.
- Correct by default: no stale overwrites, no broadcasts before the database commit, recovery after disconnects.
- Secure by default: data still flows through normal controllers and policies, never through the socket.
- First-class testing helpers for both PHP and Vue.

**Non-goals (v1)**

- Collaborative text editing, CRDTs or operational transforms.
- Presence (who is online) and typing indicators.
- Svelte and other framework adapters (the client core is framework-agnostic, so they can follow).
- Replacing Spatie Event Sourcing or Laravel Broadcasting; the package only connects them.

## Target stack and compatibility

v1 targets the current majors only, Laravel 12/13 on PHP 8.3+, to keep the test matrix small.

| Dependency | Supported | Why |
| --- | --- | --- |
| PHP | 8.3, 8.4, 8.5 | Laravel 13 requires 8.3+; enables attributes and readonly classes |
| [Laravel](https://tech-insider.org/fi/laravel-13-opas-tutorial-reverb-ai-sdk-2026/) | 12, 13 | 13 released March 2026; 12 still gets security fixes until Feb 2027 |
| [spatie/laravel-event-sourcing](https://laraplugins.io/plugins/spatie/laravel-event-sourcing) | ^7.14 | 7.14+ is the first line supporting Laravel 13 |
| [inertiajs/inertia-laravel](https://laraplugins.io/plugins/inertiajs/inertia-laravel?page=2) | ^2.0 \|\| ^3.0 | [v3 shipped March 2026](https://inertiajs.com/docs/v3/getting-started); v2 bug fixes ended Sept 2026 |
| Broadcasting | Reverb (default), Pusher, Ably | Any Echo-compatible driver; Reverb is first-party |
| Client | Vue 3.4+ or React 18/19, laravel-echo 2.x | Thin adapters over a framework-agnostic core; the adapter you do not use is an optional peer dependency |

The package only uses Inertia features present in both v2 and v3 (shared props, partial reloads via `only`), so supporting both costs little. Drop v2 once its security support ends in March 2027.

## Core concepts

v1 ships the **invalidate** model only: the socket carries a tiny "topic changed" signal, and the page re-fetches its props through its own controller.

**Vocabulary**

- **Topic** — a named stream of changes for one read model or aggregate, e.g. `documents.9f1c…`. Maps 1:1 to a broadcast channel.
- **Change signal** — the broadcast payload: topic, per-topic sequence number, affected prop keys. Never contains model data.
- **Live binding** — a page's declaration that props `['document', 'comments']` depend on topic `documents.{id}`.
- **Cursor** — the latest sequence number a page has seen per topic, sent with the initial props.

**Update models compared**

| Model | Socket payload | Latency | Security | Complexity | v1? |
| --- | --- | --- | --- | --- | --- |
| Invalidate (refetch) | \~200 bytes, no data | 1 socket hop + 1 HTTP request | Reuses controller auth and policies | Low | Yes |
| Push (patch props) | Projected data | 1 socket hop | Every field must be safe for every subscriber | High: client-side merge rules | Later, opt-in |

Invalidate wins for v1 because props stay a pure function of the controller. Per-user fields, policies and hidden attributes keep working unchanged, and there is one source of truth for page data. Push can come later as an opt-in per binding for high-frequency cases like counters or chat.

## Architecture

Two paths meet at the broadcaster: the write path turns a stored event into a signal after commit, and the read path turns that signal into a partial reload.

&#91;embedded content: architecture · write path, storage, read path\]

The signal carries only topic, version and prop keys; the page's data always comes back through its own controller.

**Sequence for one change**

1. A command handler calls the aggregate root, which records `DocumentRenamed`.
2. Spatie persists it to `stored_events` and dispatches it to projectors (sync or queued).
3. `DocumentProjector` updates the read model; the `EmitsLiveChanges` hook adds `documents.{uuid}` with the event's id to `ChangeBuffer`.
4. After the transaction commits, `ChangeFlusher` takes the topic's next sequence number from the cursor store and broadcasts one `LiveChangeBroadcast` per topic, excluding the sender's socket.
5. Reverb delivers it on `private-live.documents.{uuid}` to every authorized subscriber.
6. `LiveClient` drops it if the version is at or below the page's cursor; otherwise it queues the signal's affected props that the page binds (every bound prop if the signal lists none).
7. After 150 ms the client calls `router.reload({ only: ['document', 'activity'] })`.
8. The controller re-renders those props plus fresh cursors; Inertia patches the page without losing scroll or form state.

## Server-side API

The server API has three touchpoints: declare topics on events, mark changes in projectors, and bind topics to props in controllers.

**1. Topics on stored events (attribute).** The event declares which topic it affects; the topic template is resolved from the event's properties.

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

**2. Signals emitted after projection, not on event record.** A projector trait marks the topic changed once its read model is written. This guarantees the refetch sees the new data, including for queued projectors.

```php
use Freepeace13\InertiaLive\Concerns\EmitsLiveChanges;

final class DocumentProjector extends Projector
{
    use EmitsLiveChanges; // reads #[LiveTopic] from the event by default

    public function onDocumentRenamed(DocumentRenamed $event): void
    {
        DocumentReadModel::whereUuid($event->documentUuid)
            ->update(['title' => $event->title]);
        // trait hook marks 'documents.{uuid}' changed after this handler returns
    }
}
```

For events without the attribute, call `$this->liveChanged('documents.'.$uuid, ['document'])` explicitly.

**3. Bindings in controllers.** A macro on the Inertia response attaches topics and cursors to the page.

```php
return Inertia::render('Documents/Show', [
    'document' => DocumentResource::make($doc),
    'activity' => fn () => $doc->activity()->latest()->limit(20)->get(),
])->live("documents.{$doc->uuid}", only: ['document', 'activity']);
```

`->live()` adds a shared `_live` prop: `{ bindings: [{ topic, channel, props, cursor }] }`. The cursor is the topic's latest sequence number (see Consistency rules and [Design decisions](design-decisions.md)).

**Core server classes**

| Class | Responsibility |
| --- | --- |
| `TopicResolver` | Resolves `#[LiveTopic]` templates against event properties |
| `ChangeBuffer` | Collects changes per request or job; coalesces by topic, unions props |
| `ChangeFlusher` | Flushes the buffer after DB commit (request end, or queue job processed) |
| `LiveChangeBroadcast` | The `ShouldBroadcastNow` event sent on `private-live.{topic}`; excludes the sender's socket |
| `CursorRepository` | Issues and reads per-topic sequence numbers (default: cache store, needs atomic increment) |
| `LiveResponseMacro` | Registers `->live()` on `Inertia\Response` |

## Client-side API (Vue 3 and React)

One install makes every page with a `_live` prop live automatically; a composable or hook exists for status UI and manual control. Vue and React expose the same behaviour; only the wiring differs.

**Install once in `app.ts`**

```ts
import { createInertiaApp } from '@inertiajs/vue3'
import { InertiaLive } from '@freepeace13/inertia-live/vue'
import { echo } from './echo' // the app's configured Echo instance

createInertiaApp({
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .use(InertiaLive, { echo, debounceMs: 150 })
      .mount(el)
  },
})
```

**What the plugin does on each Inertia navigation**

1. Reads `page.props._live.bindings`.
2. Diffs against current subscriptions: leaves channels no longer bound, joins new ones.
3. On a change signal: drops it if `version <= cursor`, otherwise queues its affected props that the page binds. A signal touching no bound prop advances the cursor but triggers no reload.
4. After `debounceMs`, issues one `router.reload({ only: [...unionOfProps], preserveScroll: true, preserveState: true })`.
5. Updates cursors from the fresh `_live` prop in the reload response.

**Optional composable**

```ts
const { status, lastSyncedAt, pause, resume, refresh } = useLive()
// status: 'connecting' | 'live' | 'reconnecting' | 'offline'
```

Use `pause()` while a user edits a form so a reload does not interrupt them; queued signals flush on `resume()`.

**React.** Instead of a plugin, wrap the app in `InertiaLiveProvider` and read state with the `useLive()` hook, which returns the same `{ status, lastSyncedAt, pause, resume, refresh }`.

```tsx
import { InertiaLiveProvider } from '@freepeace13/inertia-live/react'
import { echo } from './echo'

// Persistent layout: it must render inside the Inertia tree because the provider reads usePage().
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <InertiaLiveProvider echo={echo} debounceMs={150}>{children}</InertiaLiveProvider>
}
```

Behaviour differences from Vue:

- The provider reads the page with `usePage()`, which only works inside Inertia's component tree, so it lives in a persistent layout rather than around `<App>`. A non-persistent layout still works but recreates the client on every navigation.
- The client is created in an effect and destroyed on cleanup, so React StrictMode's double mount neither leaks subscriptions nor sends duplicate reloads.
- `useLive()` is built on `useSyncExternalStore`; before the client exists (first render, SSR) it reports `status: 'connecting'`.

**Client core layout.** `LiveClient` (framework-agnostic: subscriptions, cursors, debounce queue) plus thin `vue` and `react` adapters. Both reuse `LiveClient` unchanged and add only page watching, a `router.reload` reloader and a status binding.

## Consistency rules

The core guarantee: a page never ends up older than the last change signal it received, and never misses a change silently.

| Risk | Rule |
| --- | --- |
| Signal arrives before data is committed | Flush only after the DB transaction commits (`DB::afterCommit`), and only after the projector handler returns |
| Queued or several projectors on one topic | Version = the topic's next sequence number, taken by `ChangeFlusher` after commit; every signal is newer than the last, so none is dropped as stale |
| Page renders between projection and signal (race) | The number is issued at flush; render reads it as the cursor, client drops signals with `version <= cursor` |
| Out-of-order delivery | Client keeps max version per topic; older signals are ignored |
| Burst of events (e.g. 50 in one command) | `ChangeBuffer` coalesces to one signal per topic per request/job; client debounces 150 ms across topics into one reload |
| WebSocket disconnect | On reconnect, client does one reload of all bound props, since signals may have been missed |
| Sender's own action | Broadcast uses `toOthers()` via the `X-Socket-ID` header; the sender already sees fresh props from the Inertia redirect |
| Replaying projectors (`event-sourcing:replay`) | Signals are suppressed while `Projectionist::isReplaying()`; one final signal per topic is optional via config |

**Why the version is a sequence, not the event id.** Using the stored event id as the version dropped signals whenever two projectors, or concurrent queue workers, handled the same topic. A per-topic sequence taken at flush time never repeats. Costs and alternatives: [Design decisions](design-decisions.md).

**Cache loss** restarts a topic's counter from the clock (microseconds), above every earlier number, so open pages keep accepting signals.

## Security

The socket never carries data, so the worst case of a misconfigured channel is leaking that *something* changed, not what.

- **Private channels by default.** Every topic maps to `private-live.{topic}`. Public topics are opt-in per topic pattern (`Live::publicTopic('stats.{id}')`).
- **Authorization via policies.** Topics register an authorizer in config or a service provider:

```php
Live::authorize('documents.{uuid}', fn (User $user, string $uuid) =>
    $user->can('view', Document::whereUuid($uuid)->firstOrFail())
);
```

- **Data still goes through the controller.** The reload hits the same route with the user's session, so policies, hidden attributes and per-user fields apply as usual.
- **No topic enumeration.** Topics use UUIDs, never sequential IDs.
- **Rate limits.** The flusher caps signals per topic per second (default 10) to protect clients and the broadcaster from runaway loops. Excess signals are not discarded: they collapse into one trailing signal at the end of the window.
- **Unbound topics are denied.** An authorizer is required for every private topic pattern; a missing one fails closed with a logged warning.

## Configuration, testing and layout

Config stays small: six keys cover v1.

```php
// config/inertia-live.php
return [
    'enabled'        => env('INERTIA_LIVE_ENABLED', true),
    'channel_prefix' => 'live',
    'cursor_store'   => env('INERTIA_LIVE_CURSOR_STORE'), // null = default cache
    'max_signals_per_second' => 10,
    'replay'         => ['suppress' => true, 'final_signal' => false],
    'debug'          => env('APP_DEBUG', false), // logs every flushed signal
];
```

**Testing helpers (PHP, Pest)**

```php
Live::fake();

$this->post(route('documents.rename', $doc), ['title' => 'Q4 plan']);

Live::assertChanged("documents.{$doc->uuid}", props: ['document']);
Live::assertNothingChangedFor('documents.other-uuid');
Live::assertChangedTimes("documents.{$doc->uuid}", 1); // proves coalescing
```

**Testing helpers (Vue and React, Vitest).** `createFakeLive()` returns a fake Echo that tests drive with `emit(topic, version)`, then assert on the `router.reload` calls it captured. The Vue version returns plugin `options`; the React version returns `providerProps`.

**Repository layout (monorepo)**

```
inertia-live/
├── packages/
│   ├── laravel/          # composer package
│   │   ├── src/{Attributes,Concerns,Broadcasting,Cursor,Testing}
│   │   ├── config/inertia-live.php
│   │   └── tests/        # Pest + Orchestra Testbench
│   └── client/           # npm package
│       ├── src/core/     # LiveClient, framework-agnostic
│       ├── src/vue/      # plugin + useLive
│       ├── src/react/    # InertiaLiveProvider + useLive
│       └── tests/        # Vitest
├── demo/                 # Laravel 13 demo app (Vue and React frontends)
└── .github/workflows/    # matrix: PHP 8.3-8.5 x Laravel 12-13 x Inertia 2-3
```

## Milestones and open questions

Ship v0.1 as soon as M2 passes; a small, tagged, documented release beats a complete unreleased one. Estimates assume about 10 hours a week.

1. **M1 — Signal path (1–2 weeks).** `#[LiveTopic]`, `EmitsLiveChanges`, `ChangeBuffer`, after-commit flush, private channel broadcast. Exit: a Pest test proves one signal per topic per request, sent only after commit.
2. **M2 — Vue plugin, invalidate mode (1–2 weeks).** `->live()` macro, `_live` prop, `LiveClient` subscriptions, debounce, partial reload. Exit: two browser tabs on the demo page stay in sync. **Tag v0.1.**
3. **M3 — Correctness (1 week).** Cursors, stale-signal dropping, reconnect reload, replay suppression, rate limit. Exit: tests for each row of Consistency rules.
4. **M4 — React adapter (about 1 week).** `InertiaLiveProvider`, `useLive()` hook, fake helper, StrictMode-safe lifecycle, no changes to `LiveClient`. Exit: the same adapter tests as Vue pass, plus a StrictMode test.
5. **M5 — Developer experience (1 week).** `Live::fake()`, Vitest fakes, README with a 5-minute quick start for Vue and React, Laravel 12/13 x Inertia 2/3 CI matrix. **Tag v1.0, publish to Packagist and npm.**
6. **M6 — Demo app and launch (not started; the current demo is the document page, not the chat).** The hiring-screening chat (real-time candidate threads, AI bot participants) deployed with a public URL; write-up on Laravel News or dev.to; LinkedIn post.
7. **Later.** Opt-in push mode, presence, Svelte adapter.

**Open questions**

- [ ] React: ship a helper that injects the provider through Inertia's `createInertiaApp` (if a supported hook exists in v2 and v3) so apps do not need a persistent layout.
- [ ] Package name: `inertia-live-projections` vs shorter `inertia-live` (check Packagist and npm availability).
- [ ] Should non-event-sourced Eloquent models be able to emit signals too (wider audience, weaker DDD focus)?
- [ ] Cursor store default: cache vs a small `live_cursors` table for durability.
- [ ] Debounce default of 150 ms: validate against the demo's chat use case, which may want 0.
