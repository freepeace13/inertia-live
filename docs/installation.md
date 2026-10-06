# Installation

## Requirements

| Dependency | Supported |
| --- | --- |
| PHP | 8.3, 8.4, 8.5 |
| Laravel | 12, 13 |
| `inertiajs/inertia-laravel` | ^2.0 or ^3.0 |
| `spatie/laravel-event-sourcing` | ^7.14 |
| Broadcaster | Reverb, Pusher or Ably (any Echo-compatible driver) |
| Client | Vue 3.4+ or React 18/19, `laravel-echo` ^2.0, `@inertiajs/vue3` or `@inertiajs/react` ^2 or ^3 |

CI runs the server against PHP 8.3 to 8.5, Laravel 12 and 13, and Inertia 2 and 3, and the client against Inertia 2 and 3 and React 18 and 19.

## Server

```bash
composer require freepeace13/inertia-live-projections
```

The service provider is auto-discovered. It merges the default config, registers the `->live()` macro on `Inertia\Response` and hooks the flush points (request end, queue jobs, replays).

Optionally publish the config:

```bash
php artisan vendor:publish --tag=inertia-live-config
```

See [Configuration](configuration.md) for the keys.

### Broadcasting

Inertia Live uses Laravel's normal broadcasting. If broadcasting is not set up yet:

```bash
php artisan install:broadcasting   # installs Reverb and Echo scaffolding
```

You need:

- A working broadcaster (`BROADCAST_CONNECTION=reverb`, or `pusher`/`ably`) with the server running.
- Channel authorization routes enabled, so `private-live.*` channels can be authorized. `Live::authorize()` registers its callbacks with `Broadcast::channel()`, so they end up in your normal channel authorization flow.
- A queue is **not** required for the signal: `LiveChangeBroadcast` implements `ShouldBroadcastNow`.

## Client

```bash
npm install @freepeace13/inertia-live laravel-echo
```

Vue and React are optional peer dependencies. Install only the adapter you use (`@inertiajs/vue3` + `vue`, or `@inertiajs/react` + `react`).

Configure Echo once and pass the instance to the adapter:

```ts
// resources/js/echo.ts
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

export const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: import.meta.env.VITE_REVERB_PORT,
  forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
  enabledTransports: ['ws', 'wss'],
})
```

Then wire up the adapter: [Vue 3](vue.md) or [React](react.md).

### Package entry points

| Import | Contents |
| --- | --- |
| `@freepeace13/inertia-live` | `LiveClient`, `CursorStore`, `ConnectionTracker` and types |
| `@freepeace13/inertia-live/testing` | Framework-agnostic `createFakeLive()` |
| `@freepeace13/inertia-live/vue` | `InertiaLive` plugin, `useLive()`, `inertiaReloader` |
| `@freepeace13/inertia-live/vue/testing` | Vue `createFakeLive()` |
| `@freepeace13/inertia-live/react` | `InertiaLiveProvider`, `useLive()`, `inertiaReloader` |
| `@freepeace13/inertia-live/react/testing` | React `createFakeLive()` |

## Wiring checklist

1. Event carries `#[LiveTopic]` ([Topics](topics.md)).
2. Projector uses `EmitsLiveChanges` ([Projectors](projectors.md)).
3. Topic pattern has a `Live::authorize()` callback ([Authorization](authorization.md)).
4. Controller calls `->live(...)` ([Page bindings](bindings.md)).
5. Client plugin or provider is installed ([Vue](vue.md) / [React](react.md)).
