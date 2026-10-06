# Changelog

## Unreleased

### Added
- Server: `#[LiveTopic]`, `EmitsLiveChanges`, after-commit `ChangeFlusher`, private-channel `LiveChangeBroadcast`, cache-backed cursors, `Live::authorize()`, the Inertia `->live()` macro and `_live` prop, replay suppression, `Live::fake()`.
- Client: framework-agnostic `LiveClient`, Vue 3 plugin and `useLive()`, React `InertiaLiveProvider` and `useLive()`, fake Echo helpers.
- CI: PHP 8.3–8.5 × Laravel 12–13 × Inertia 2–3; client on Inertia 2/3 × React 18/19.
