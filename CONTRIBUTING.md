# Contributing

Thanks for helping. This repository holds the client packages (`core`, `vue`, `react`). The server is [inertia-live-laravel](https://github.com/freepeace13/inertia-live-laravel) and the docs and release program are in [inertia-live-docs](https://github.com/freepeace13/inertia-live-docs).

## Setup

```sh
pnpm install
pnpm build
pnpm test        # Node 22 or later
pnpm typecheck
pnpm lint        # Biome; `pnpm format` fixes
```

## Rules

- Put a failing test first. Tests live in `tests/{core,vue,react}`.
- A user-visible change adds an entry under `## Unreleased` in `CHANGELOG.md`.
- A change to the wire protocol (signal shape, `_live`, cursors, `X-Socket-ID`) needs the matching server change and the spec in `inertia-live-docs/v1/protocol.md`, and the shared fixture `v1/fixtures/protocol-1.json` if a shape moves. Do not change one side alone.
- Keep versions shared by the CI matrix (Inertia, React, Vue, laravel-echo) in the catalog in `pnpm-workspace.yaml`.
- Releases go through the release workflow. Do not tag or publish by hand.
