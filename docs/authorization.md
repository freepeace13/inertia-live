# Authorization and security

The socket carries only `{ topic, version, props }`. The worst outcome of a misconfigured channel is leaking *that something changed*, never *what*. The page's data always comes back through your controller with the user's session.

## Private topics (default)

Every topic is broadcast on `private-{channel_prefix}.{topic}`. Subscribing requires passing Laravel's channel authorization, which you register with `Live::authorize()`:

```php
use Freepeace13\InertiaLive\Facades\Live;

Live::authorize('documents.{uuid}', fn (User $user, string $uuid) =>
    $user->can('view', Document::whereUuid($uuid)->firstOrFail())
);
```

Register authorizers in a service provider's `boot()` (or any code that runs on every request that handles channel auth).

- The first argument is a **pattern**. Each `{placeholder}` matches one dot-free segment of the topic.
- The callback receives the authenticated user followed by the pattern's parameters, exactly like `Broadcast::channel()`. Return a truthy value to allow, falsy to deny.
- Under the hood it calls `Broadcast::channel("{channel_prefix}.{pattern}", $callback)`, so it participates in your normal broadcasting auth endpoint.

### Fail closed

If a private topic has no matching authorizer, nobody could subscribe to it, so the flusher does not send the signal and logs:

```
Inertia Live topic has no authorizer; signal not sent.
```

The cursor is still recorded. Register an authorizer for every private topic pattern you use.

## Public topics

Visibility belongs to the topic *pattern*, registered once, so the attribute, the `->live()` binding and the broadcast can never disagree:

```php
Live::publicTopic('stats.global');
```

Public topics use `Echo.channel()` and skip authorizers. The payload is still data-free. Registering one pattern as both public and private throws. A topic with no registration is private, and fails closed until you add an authorizer.

## Checklist

- Use UUIDs in topics, never sequential IDs, to prevent enumeration. Nothing enforces this; it is a convention. Placeholder values are validated though: only letters, digits and `_-=@,;` are accepted (no dots), otherwise resolving the topic throws.
- Authorize with the same policy your controller uses.
- Never put sensitive values in topic names; they are visible on the wire.
- Leave `max_signals_per_second` set; it protects clients and the broadcaster from runaway loops. Excess signals collapse into one trailing signal, so they are delayed, not lost.
- Reloads hit your existing routes, so route middleware and policies apply unchanged.
