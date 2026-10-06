# Configuration

Publish the file with:

```bash
php artisan vendor:publish --tag=inertia-live-config
```

```php
// config/inertia-live.php
return [
    'enabled' => env('INERTIA_LIVE_ENABLED', true),
    'channel_prefix' => 'live',
    'cursor_store' => env('INERTIA_LIVE_CURSOR_STORE'), // null = default cache
    'cursor_ttl' => 60 * 60 * 24 * 30,
    'max_signals_per_second' => 10,
    'replay' => ['suppress' => true, 'final_signal' => false],
    'debug' => env('APP_DEBUG', false), // logs every flushed signal
];
```

| Key | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Master switch for recording changes. When `false`, projectors record nothing and no signals are sent |
| `channel_prefix` | `'live'` | Prefix of every channel: `{prefix}.{topic}`. Must be a non-empty string. If you change it, authorizers and client channels follow automatically because both are derived from it |
| `cursor_store` | `null` | Name of the Laravel cache store holding cursors. `null` uses the default store |
| `max_signals_per_second` | `10` | Per-topic cap on broadcast signals; the excess collapses into one trailing signal. Must be an integer of at least 1 |
| `cursor_ttl` | 30 days | Seconds a topic's counter lives after it is created; `null` keeps counters forever. When one expires, the next number restarts from the clock, above every earlier one, so this is safe |
| `replay.suppress` | `true` | Suppress signals while `Projectionist::isReplaying()` |
| `replay.final_signal` | `false` | After a replay, send one signal per touched topic (it takes a fresh sequence number, so open pages accept it) |
| `debug` | `APP_DEBUG` | Log every flushed signal at debug level (topic, version, props) |

## Validation

The service provider validates config when it boots and throws `InvalidArgumentException` for:

- `inertia-live.channel_prefix` that is not a non-empty string
- `inertia-live.max_signals_per_second` below 1

## Environment variables

| Variable | Maps to |
| --- | --- |
| `INERTIA_LIVE_ENABLED` | `enabled` |
| `INERTIA_LIVE_CURSOR_STORE` | `cursor_store` |
| `APP_DEBUG` | `debug` |

## Client options

Client-side options (`debounceMs`, `connection`, `reload`, `onError`) are passed to the adapter. See [Client core](client-core.md#options), [Vue](vue.md) and [React](react.md).
