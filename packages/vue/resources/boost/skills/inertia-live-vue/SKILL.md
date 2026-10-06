---
name: inertia-live-vue
description: Make a Vue 3 Inertia page live with @freepeace13/inertia-live-vue — install the plugin, show connection status, pause reloads while editing a form, and test with the fake. Use when working with Inertia Live, live props, topic signals or `useLive()` in a Vue app.
---

# Inertia Live for Vue

## When to use

Activate when a Vue 3 + Inertia page should update itself from server-side Spatie Event Sourcing projections, or when touching `InertiaLive`, `useLive()` or `_live` props.

## Setup (once)

```ts
import { createInertiaApp } from '@inertiajs/vue3'
import { InertiaLive } from '@freepeace13/inertia-live-vue'
import { echo } from './echo' // configured laravel-echo instance

createInertiaApp({
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .use(InertiaLive, { echo, debounceMs: 150 })
      .mount(el)
  },
})
```

Install with `npm install @freepeace13/inertia-live-vue laravel-echo`. Requires Vue 3.4+ and `@inertiajs/vue3` ^2 or ^3.

## Pages

A page needs nothing extra: if its controller returns `->live("documents.{$doc->uuid}", only: ['document', 'activity'])`, the plugin subscribes and reloads exactly those props when the topic changes. Policies and per-user fields keep working because the reload goes through the same controller.

## Status and manual control

```ts
import { useLive } from '@freepeace13/inertia-live-vue'

const { status, lastSyncedAt, pause, resume, refresh } = useLive()
```

- `status`: `'connecting' | 'live' | 'reconnecting' | 'offline'`
- `pause()` while a user edits a form so a reload does not clobber it; queued signals flush on `resume()`.
- `refresh()` forces a reload of the bound props.

## Testing

```ts
import { createFakeLive } from '@freepeace13/inertia-live-vue/testing'

const fake = createFakeLive()
app.use(InertiaLive, fake.options)
fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```

## Do not

- Add per-page `Echo.private(...).listen(...)` code; the plugin owns subscriptions.
- Put server concerns (topics, authorization, projectors) in the client; those belong to `freepeace13/inertia-live-laravel`.
