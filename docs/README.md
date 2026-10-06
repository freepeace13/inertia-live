# Inertia Live documentation

Inertia Live keeps Inertia pages in sync with [Spatie Event Sourcing](https://github.com/spatie/laravel-event-sourcing) projections. The server declares which projection changes affect which page props; the package broadcasts a small "topic changed" signal and the client reloads only the affected props through the page's own controller.

## How the pieces fit

```
stored event ──► projector ──► ChangeBuffer ──► (after commit) ChangeFlusher ──► Echo/Reverb
  #[LiveTopic]   EmitsLiveChanges   coalesce          sequence + rate limit         private-live.{topic}
                                                                                         │
page props ◄── router.reload({ only }) ◄── debounce ◄── LiveClient (drops stale versions)
```

The socket never carries model data. Policies, hidden attributes and per-user fields keep working because the data still comes from your controller.

## Read in this order

| Doc | What it covers |
| --- | --- |
| [Installation](installation.md) | Requirements, packages, broadcasting and Echo setup |
| [Topics](topics.md) | `#[LiveTopic]`, template placeholders, explicit `liveChanged()` |
| [Projectors](projectors.md) | `EmitsLiveChanges`, the change buffer, flushing, queues and replays |
| [Page bindings](bindings.md) | `->live()` on Inertia responses and the `_live` prop |
| [Authorization](authorization.md) | `Live::authorize()`, private and public topics, fail-closed rules |
| [Consistency](consistency.md) | Versions, cursors, ordering, debouncing and reconnects |
| [Design decisions](design-decisions.md) | Why versions are per-topic sequences, and what that costs |
| [Configuration](configuration.md) | Every `config/inertia-live.php` key |
| [Client core](client-core.md) | `LiveClient`, the framework-agnostic API, Echo and connection types |
| [Vue 3](vue.md) | `InertiaLive` plugin and `useLive()` |
| [React](react.md) | `InertiaLiveProvider` and `useLive()` |
| [Testing](testing.md) | `Live::fake()` for PHP, `createFakeLive()` for Vitest |
| [Troubleshooting](troubleshooting.md) | Symptoms, causes and fixes |

For the original design rationale, goals and milestones see [SPEC.md](SPEC.md).

## Packages

| Package | Location | Purpose |
| --- | --- | --- |
| `freepeace13/inertia-live-projections` | `packages/laravel` | Server: attribute, projector trait, flusher, broadcast, `->live()` macro, test fake |
| `@freepeace13/inertia-live` | `packages/client` | Client: `LiveClient` core plus `/vue` and `/react` adapters |
| Demo app | `demo/` | Laravel 13 app with Vue and React frontends |
