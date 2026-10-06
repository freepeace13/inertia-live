# Troubleshooting

Turn on signal logging with `'debug' => true` in `config/inertia-live.php` (it defaults to `APP_DEBUG`). Every flushed signal is logged with topic, version and props.

## Nothing updates

Walk the path from the write side to the page:

| Check | What to look for |
| --- | --- |
| Is the event recorded as a change? | Projector uses `EmitsLiveChanges`, event has `#[LiveTopic]` (or the handler calls `liveChanged()`), and `inertia-live.enabled` is `true` |
| Is the signal flushed? | With `debug` on, a "signal flushed" log line appears after the request or job |
| Is it dropped server-side? | Logs: "topic has no authorizer; signal not sent" or "signal dropped by rate limit" |
| Is the broadcaster running? | Reverb/Pusher up, `BROADCAST_CONNECTION` set |
| Does the page have bindings? | `page.props._live.bindings` is non-empty; the controller calls `->live()` |
| Can the browser subscribe? | Channel auth endpoint returns 200 for `private-live.{topic}`; authorizer registered |
| Is the client installed? | Vue plugin or React provider present; `echo` is the configured instance |
| Does the signal reach a bound prop? | Signal `props` intersect the binding's `only` (an empty `only` never reloads) |

## Log: "Inertia Live topic has no authorizer; signal not sent."

A private topic has no `Live::authorize()` pattern matching it. Register one, remembering that each `{placeholder}` matches one dot-free segment. See [Authorization](authorization.md).

## Log: "Inertia Live signal dropped by rate limit."

The topic exceeded `max_signals_per_second`. Open pages may stay stale until the next change; reload or call `refresh()`. Raise the limit or reduce how often the topic changes. Bursts inside one request are already coalesced.

## `InvalidArgumentException` mentioning a topic template

`TopicResolver` rejected `#[LiveTopic]`: a `{placeholder}` has no matching public event property, or the property is not a scalar. Fix the template or the event.

## `InvalidArgumentException` at boot

Config validation failed: `channel_prefix` must be a non-empty string and `max_signals_per_second` at least 1.

## `useLive()` throws

- Vue: "useLive() needs the InertiaLive plugin". Install `app.use(InertiaLive, { echo })`.
- React: "useLive() must be used inside `<InertiaLiveProvider>`". Render the provider higher in the tree.

## React: subscriptions reset on every navigation

The provider is in a non-persistent layout, or `echo`/`connection` are new objects each render. Use a persistent layout and a module-level `echo`.

## Duplicate reloads for the sender

The sender's socket is excluded using the `X-Socket-ID` header. If your requests do not send it, the sender also receives its own signal and reloads once more. This is harmless but wasteful.

## The page flickers or loses form input

Call `pause()` while the user edits and `resume()` afterwards. Reloads preserve scroll and component state, but props you bind to inputs will be replaced if the server value changed.

## Status stays `live` while the socket is down

Status comes from `echo.connector.pusher.connection`. Non-Pusher drivers have none, so they report `live` and never run the reconnect reload. Pass a `connection` implementing `ConnectionLike`.

## Replays flood the broadcaster

Keep `replay.suppress` at `true`. Set `replay.final_signal` to `true` if pages should refresh once after the replay.

## Stale page after a cache flush

Cursors live in the cache. A flush resets them to 0, which causes extra reloads but not stale data. In multi-server deployments, point `cursor_store` at a shared store.
