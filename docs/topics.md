# Topics

A **topic** is a named stream of changes for one read model or aggregate, for example `documents.9f1c2e…`. Every topic maps to exactly one broadcast channel: `{channel_prefix}.{topic}`, which is `live.documents.9f1c2e…` by default (Echo prefixes private channels with `private-` on the wire).

Use stable, non-guessable identifiers (UUIDs) in topics. Sequential IDs make topics enumerable.

## `#[LiveTopic]`

Put the attribute on a stored event to declare which topic it affects.

```php
use Freepeace13\InertiaLive\Attributes\LiveTopic;

#[LiveTopic('documents.{documentUuid}', props: ['document', 'activity'])]
final class DocumentRenamed extends ShouldBeStored
{
    public function __construct(
        public readonly string $documentUuid,
        public readonly string $title,
    ) {}
}
```

| Parameter | Type | Default | Meaning |
| --- | --- | --- | --- |
| `template` | `string` | required | Topic name with `{placeholder}` segments |
| `props` | `list<string>` | `[]` | Page prop keys this change affects. Empty means "unknown": the client reloads every prop the page bound to the topic |
| `public` | `bool` | `false` | Broadcast on a public channel with no authorization |

The attribute is repeatable. An event that affects several aggregates declares one attribute per topic:

```php
#[LiveTopic('documents.{documentUuid}', props: ['document'])]
#[LiveTopic('folders.{folderUuid}', props: ['documents'])]
final class DocumentMoved extends ShouldBeStored { /* ... */ }
```

## Template placeholders

`{name}` is replaced with the event's public property of the same name. `TopicResolver` throws an `InvalidArgumentException` when:

- the property does not exist on the event, or
- the property value is not a scalar (arrays and objects are rejected; ints, floats, bools and strings are cast to string).

These errors surface when the projector handles the event, so a broken template fails loudly instead of silently never broadcasting.

An event without the attribute resolves to no topics and is ignored by `EmitsLiveChanges`.

## Declaring `props`

Props are a hint for the client: a signal lists the prop keys that changed, and the client reloads only the intersection with the props the page bound with `->live(only: [...])`. If the intersection is empty the cursor advances but nothing reloads.

```
signal.props   = ['activity']
binding.props  = ['document', 'activity']   → reload only ['activity']

signal.props   = ['comments']
binding.props  = ['document', 'activity']   → no reload

signal.props   = []                          → reload ['document', 'activity']
```

Props from several events in one request are unioned per topic (see [Projectors](projectors.md#coalescing)).

## Explicit changes: `liveChanged()`

For events without the attribute, or when the topic depends on logic rather than a property, call `liveChanged()` from inside a projector handler:

```php
public function onCommentAdded(CommentAdded $event): void
{
    Comment::create([/* ... */]);

    $this->liveChanged('documents.'.$event->documentUuid, ['comments']);
}
```

Signature: `liveChanged(string $topic, array $props = [], bool $public = false)`.

It is available on projectors using `EmitsLiveChanges` and is only active while a stored event is being handled: the version it records is that event's id. Calling it from anywhere else (a controller, a command) does nothing. It is also a no-op when `inertia-live.enabled` is `false`.

## Topic patterns and authorization

A topic like `documents.9f1c…` matches the authorizer pattern `documents.{uuid}`. Each placeholder matches one dot-free segment, so `documents.{uuid}` does not match `documents.9f1c.comments`. Register a separate pattern for deeper topics. See [Authorization](authorization.md).
