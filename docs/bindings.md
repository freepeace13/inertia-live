# Page bindings

A **live binding** says: "these props on this page depend on this topic." You declare it in the controller with the `->live()` macro on the Inertia response.

```php
return Inertia::render('Documents/Show', [
    'document' => DocumentResource::make($doc),
    'activity' => fn () => $doc->activity()->latest()->limit(20)->get(),
])->live("documents.{$doc->uuid}", only: ['document', 'activity']);
```

## `->live()`

```php
live(string $topic, array $only = [], bool $public = false): Inertia\Response
```

| Argument | Meaning |
| --- | --- |
| `$topic` | The resolved topic name (not the template) |
| `$only` | Prop keys that depend on the topic. Always list them: with an empty list the client has nothing to reload, so the page never updates |
| `$public` | Subscribe with `echo.channel()` instead of `echo.private()`. Must match how the topic is broadcast |

Call it more than once to bind several topics:

```php
return Inertia::render('Documents/Show', [...])
    ->live("documents.{$doc->uuid}", only: ['document'])
    ->live("folders.{$doc->folderUuid}", only: ['siblings']);
```

## The `_live` prop

`->live()` adds one prop, `_live`, to the response:

```json
{
  "_live": {
    "bindings": [
      {
        "topic": "documents.9f1c…",
        "channel": "live.documents.9f1c…",
        "props": ["document", "activity"],
        "cursor": 4126,
        "public": false
      }
    ]
  }
}
```

| Field | Meaning |
| --- | --- |
| `topic` | Topic name |
| `channel` | `{channel_prefix}.{topic}`, the name passed to Echo |
| `props` | Props to reload when the topic changes |
| `cursor` | Last version applied to the topic's read model at render time |
| `public` | Whether to use a public channel |

Details worth knowing:

- `_live` is wrapped in `Inertia::always()`, so it is present on partial reloads even when `only` lists other props. That is how cursors stay fresh after each live reload.
- It is resolved lazily on every render, so each render reads the current cursor from the `CursorRepository`.
- The client treats a changed `_live` object as a navigation: it joins new channels, leaves removed ones and raises cursors.
- Pages without `->live()` have no `_live` prop and open no subscriptions.

## Partial reloads and lazy props

The client reloads with `router.reload({ only: [...] })`, so only the listed props are re-evaluated. Closure props (`fn () => ...`) in your controller are only run when requested, which makes live reloads cheap for expensive props. `router.reload` keeps scroll position and component state by default, so a live update does not disturb the user.

Props listed in `only` must be real prop keys of that page.
