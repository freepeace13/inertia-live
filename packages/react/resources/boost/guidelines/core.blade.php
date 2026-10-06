## Inertia Live (React)

Live Inertia pages: the server declares which projection changes affect which page props, and `@freepeace13/inertia-live-react` reloads those props when a "topic changed" signal arrives. Do not write per-page WebSocket or Echo listener code.

- Render `<InertiaLiveProvider echo={echo} debounceMs={150}>` once inside the Inertia tree (it uses `usePage()`, so it cannot wrap `<App>`), where `echo` is the app's configured `laravel-echo` instance. Put it in a persistent layout (`Page.layout = (page) => <AppLayout>{page}</AppLayout>`) so the subscription survives navigation. Every page that carries a `_live` prop becomes live.
- Pages need no live-specific code. The server binds topics with `Inertia::render(...)->live("topic", only: ['prop'])`; the client reloads only those props through the page's own controller.
- Use `useLive()` from `@freepeace13/inertia-live-react` only for status UI or manual control: `{ status, lastSyncedAt, pause, resume, refresh }`. Call `pause()` while a user edits a form and `resume()` afterwards.
- `status` is one of `'connecting' | 'live' | 'reconnecting' | 'offline'`.
- In tests, use `createFakeLive()` from `@freepeace13/inertia-live-react/testing`, render `<InertiaLiveProvider {...fake.providerProps}>`, and drive signals with `fake.emit(topic, version)`.
- The server side lives in `freepeace13/inertia-live-laravel` (`#[LiveTopic]`, `EmitsLiveChanges`, `Live::authorize()`); do not reimplement it on the client.
