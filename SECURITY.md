# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub's "Report a vulnerability" button on the Security tab of this repository (private vulnerability reporting).

Include what you found, how to reproduce it, and which version you tested. You will get an answer, and a fix or a decision, as soon as it can be assessed.

## What counts

Inertia Live carries a "this topic changed" signal and a cursor, never page data. Reports about these are in scope:

- A way to learn that a private topic changed, or its cursor, without being allowed to subscribe to it (including through the cursors endpoint).
- A way to receive another user's private signals.
- A way to read page data through the signal path rather than the page's own controller.

## Supported versions

Critical fixes only, for the current minor and the one before it. After 1.0: the current major, and the previous major for six months. See the release policy in [inertia-live-docs](https://github.com/freepeace13/inertia-live-docs/blob/main/release-policy.md).
