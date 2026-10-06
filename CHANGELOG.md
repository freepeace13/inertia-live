# Changelog

Client and repository changes. Server changes are tracked in [freepeace13/inertia-live-laravel](https://github.com/freepeace13/inertia-live-laravel/blob/main/CHANGELOG.md).

## 0.1.0 - 2026-10-07

### Changed
- The repository is a pnpm workspace. Package tests move from `packages/*/tests` to `tests/{core,vue,react}`, each its own private package. `@freepeace13/inertia-live-vue` and `-react` ship Laravel Boost guidelines and skills in `resources/boost/`.

### Changed (breaking, pre-1.0)
- `LiveClient.afterReload()` is removed: the adapters never called it, and `sync()` already advances cursors.
- The single npm package `@freepeace13/inertia-live` is split into `@freepeace13/inertia-live-core`, `@freepeace13/inertia-live-vue` and `@freepeace13/inertia-live-react` (npm workspaces under `packages/`). Imports change from `@freepeace13/inertia-live/vue` to `@freepeace13/inertia-live-vue`, `/vue/testing` to `-vue/testing`, and the root and `/testing` entries move to `-core`.
- The Laravel adapter moves to its own repository, `freepeace13/inertia-live-laravel`, and the Composer package is renamed from `freepeace13/inertia-live-projections`.

- Signal versions are a per-topic sequence taken at flush time, not the stored event id ([Design decisions](https://github.com/freepeace13/inertia-live-docs/blob/main/design-decisions.md)). Fixes signals being dropped when several projectors, or concurrent queue workers, handle one topic. `CursorRepository::put()` becomes `next()`; `Change` no longer carries a version; `LiveChangeBroadcast` takes it as its second argument. The cursor store must support atomic `increment`; versions are opaque clock-seeded numbers (~1.8e15). The `force` flag on replay signals is removed as redundant.
- Topic visibility is a property of the pattern: `Live::publicTopic('stats.{id}')` replaces `public:` on `#[LiveTopic]` and `->live()`. `Change` and `ResolvedTopic` lose `public`; `LiveChangeBroadcast` takes it as a second argument.
- `->live($topic, only: [...])` now requires a non-empty `only`.
- `LiveClient::pause()` is counted and returns a release function; `useLive()` pauses are scoped to the component and the adapters reset them on navigation.

### Fixed (client)
- A pause release that outlives `resetPause()` no longer lifts a pause taken on the next page (holds are tokens).
- Reloads cancelled by another Inertia visit are retried instead of being marked synced (`ReloadCancelled`).
- `refresh()` and reconnect catch-up no longer overlap an in-flight reload.
- Subscription verification: one debounced `_live` read per burst, and only a response requested after the ack counts.
- The Vue plugin is inert during SSR.
- React `useLive().pause()` called before the provider's client exists is applied once it does.
- Non-numeric signal versions and missing signal `props` are handled.

### Fixed
- Rate-limited signals collapse into one trailing signal instead of being dropped.
- A steady signal stream can no longer starve the client debounce (`maxWaitMs`).
- A signal sent between render and subscription is recovered on subscribe.
- `replay.final_signal` reaches open pages (it takes a newer sequence number).
- Failed reloads are retried with backoff; the default reloader rejects on Inertia `onError`.
- Mixed public and private changes on one topic no longer coalesce to public.
- `Live::fake()` can be called repeatedly and no longer rebinds `LiveManager`.
- Rolled-back transactions no longer broadcast or advance the cursor.
- One failing topic no longer drops the other topics in a flush.
- Placeholder values are validated (no dots or characters invalid in channel names).
- Reconnect while paused queues the reload; the Vue and React adapters send `X-Socket-ID` for sender exclusion.
- Cursors expire after `cursor_ttl` (safe: a restarted counter begins at the clock); `TopicResolver` caches reflection.

### Added (client)
- `LiveClient.stale` / `onStale()` and `useLive().stale`: reloads gave up after repeated failures.
- `createInertiaReloader(router)` in core, shared by the Vue and React adapters.
- CI covers Inertia 2/3 on both adapters, a minimum-version cell (Inertia ~2.0, React 18, Node 20), and the recommended Biome rules.

### Added
- Server: `#[LiveTopic]`, `EmitsLiveChanges`, after-commit `ChangeFlusher`, private-channel `LiveChangeBroadcast`, cache-backed cursors, `Live::authorize()`, the Inertia `->live()` macro and `_live` prop, replay suppression, `Live::fake()`.
- Client: framework-agnostic `LiveClient`, Vue 3 plugin and `useLive()`, React `InertiaLiveProvider` and `useLive()`, fake Echo helpers.
- CI: PHP 8.3–8.5 × Laravel 12–13 × Inertia 2–3; client on Inertia 2/3 × React 18/19.
