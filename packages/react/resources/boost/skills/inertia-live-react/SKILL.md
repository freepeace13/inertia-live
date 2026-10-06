---
name: inertia-live-react
description: Make a React Inertia page live with @freepeace13/inertia-live-react — add the provider in a persistent layout, show connection status, pause reloads while editing a form, and test with the fake. Use when working with Inertia Live, live props, topic signals or `useLive()` in a React app.
---

# Inertia Live for React

## When to use

Activate when a React + Inertia page should update itself from server-side Spatie Event Sourcing projections, or when touching `InertiaLiveProvider`, `useLive()` or `_live` props.

## Setup (once)

Install with `npm install @freepeace13/inertia-live-react laravel-echo`. Requires React 18/19 and `@inertiajs/react` ^2 or ^3.

`InertiaLiveProvider` reads the page with `usePage()`, so render it inside the Inertia tree in a persistent layout, not around `<App>`:

```tsx
import { InertiaLiveProvider } from '@freepeace13/inertia-live-react'
import { echo } from './echo' // configured laravel-echo instance

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <InertiaLiveProvider echo={echo} debounceMs={150}>
      {children}
    </InertiaLiveProvider>
  )
}

// Pages: Show.layout = (page) => <AppLayout>{page}</AppLayout>
```

## Pages

A page needs nothing extra: if its controller returns `->live("documents.{$doc->uuid}", only: ['document', 'activity'])`, the provider subscribes and reloads exactly those props when the topic changes. Policies and per-user fields keep working because the reload goes through the same controller.

## Status and manual control

```tsx
import { useLive } from '@freepeace13/inertia-live-react'

const { status, lastSyncedAt, stale, pause, resume, refresh } = useLive()
```

- `status`: `'connecting' | 'live' | 'reconnecting' | 'offline'`
- `pause()` while a user edits a form so a reload does not clobber it; queued signals flush on `resume()`.
- `refresh()` forces a reload of the bound props.

## Testing

```tsx
import { createFakeLive } from '@freepeace13/inertia-live-react/testing'

const fake = createFakeLive()
render(<InertiaLiveProvider {...fake.providerProps}>{children}</InertiaLiveProvider>)
fake.emit('documents.a', 1)
// after the debounce window: fake.reloads === [['document']]
```

## Do not

- Add per-page `Echo.private(...).listen(...)` code; the provider owns subscriptions.
- Put server concerns (topics, authorization, projectors) in the client; those belong to `freepeace13/inertia-live-laravel`.
