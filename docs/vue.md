# Vue 3

Requires `vue` ^3.4, `@inertiajs/vue3` ^2 or ^3 and `laravel-echo` ^2.

## Install the plugin

Install once in `app.ts`. Every page carrying a `_live` prop becomes live; no per-page code.

```ts
import { createInertiaApp } from '@inertiajs/vue3'
import { InertiaLive } from '@freepeace13/inertia-live-vue'
import { createApp, h } from 'vue'
import { echo } from './echo'

createInertiaApp({
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .use(InertiaLive, { echo, debounceMs: 150 })
      .mount(el)
  },
})
```

Register `InertiaLive` after Inertia's `plugin`: it calls `usePage()`.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `echo` | required | Your laravel-echo instance |
| `debounceMs` | `150` | Debounce window; `0` reloads immediately |
| `maxWaitMs` | `debounceMs * 4` | Longest a steady signal stream can postpone a reload |
| `connection` | Pusher connection | Override connection observation for other Echo drivers |
| `reload` | `router.reload` based | Replace the reloader (mainly for tests) |
| `onError` | none | Called when a live reload fails |

### What the plugin does

- Creates one `LiveClient`.
- Watches `usePage().props._live` and calls `client.sync()` on every change, so subscriptions and cursors follow navigation and reloads.
- Provides the client to `useLive()`.
- Wraps `app.unmount()` to stop the watcher and `destroy()` the client.

The default reloader, `inertiaReloader`, runs `router.reload({ only })` and resolves in `onFinish`. It is also exported if you want to wrap it.

## `useLive()`

```ts
import { useLive } from '@freepeace13/inertia-live-vue'

const { status, lastSyncedAt, pause, resume, refresh } = useLive()
```

| Member | Type |
| --- | --- |
| `status` | `Ref<'connecting' \| 'live' \| 'reconnecting' \| 'offline'>` |
| `lastSyncedAt` | `Ref<Date \| null>` |
| `pause()` | Hold reloads; signals keep queueing. Scoped to this component: released on unmount and on navigation |
| `resume()` | Release this component's latest pause and flush anything queued |
| `refresh()` | Reload every live prop now; returns a promise |

Call it in `setup()`. Its listeners are removed automatically when the effect scope is disposed. It throws if the plugin is not installed.

### Example: status badge and form editing

```vue
<script setup lang="ts">
import { useLive } from '@freepeace13/inertia-live-vue'

const { status, lastSyncedAt, pause, resume } = useLive()
</script>

<template>
  <span :data-status="status">{{ status }}</span>
  <small v-if="lastSyncedAt">Synced {{ lastSyncedAt.toLocaleTimeString() }}</small>

  <input @focus="pause" @blur="resume" />
</template>
```

`pause()` stops a reload from interrupting an edit; queued signals flush on `resume()`.

## Testing

```ts
import { createFakeLive } from '@freepeace13/inertia-live-vue/testing'

const fake = createFakeLive({ debounceMs: 0 })
app.use(InertiaLive, fake.options)

fake.emit('documents.a', 1, ['document'])
// fake.reloads === [['document']]
```

See [Testing](testing.md) for the full fake API.
