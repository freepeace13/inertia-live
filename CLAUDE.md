# inertia-live (client packages)

Client side of Inertia Live: live Inertia pages driven by Spatie Event Sourcing projections. The server broadcasts a small "topic changed" signal; the client reloads only the affected props through the page's own controller.

Packages (pnpm workspace, `packages/*`): `@freepeace13/inertia-live-core` (framework-agnostic `LiveClient`), `-vue` (plugin and `useLive()`), `-react` (provider and `useLive()`). `vue` and `react` depend on `core` via `workspace:^`. Tests live outside the packages in `tests/{core,vue,react}`, each a private package.

## Commands

```sh
pnpm install
pnpm build        # tsc per package
pnpm test         # vitest, all of tests/*; Node 22+ required
pnpm typecheck
pnpm lint         # biome check .
pnpm format       # biome check --write .
```

CI runs a matrix by rewriting the pnpm catalog in `pnpm-workspace.yaml` (Inertia 2/3, React 18/19, Vue and laravel-echo for the `lowest` cell; Node 22). Keep the shared versions in the catalog, not in package.json files.

## The release program (read this first for anything about releases or 1.0)

The source of truth is the docs repo, `../inertia-live-docs` (local sibling checkout; GitHub `freepeace13/inertia-live-docs`):

- `release-policy.md`: versioning, branches, support window, dist-tags, release flow
- `roadmap.md`: the road to 1.0, definition of done, open questions
- `decision-log.md`: numbered decisions (D-001 and up)

A private progress tracker mirrors these: https://claude.ai/artifact/PjKwna6Tty3ZnZFKneBjhT (owner access; checklist state lives in its database). When you change policy, plan or decisions: update the docs repo first, then the tracker, in the same piece of work. If they disagree, the docs win.

Related repos (siblings): `../inertia-live-laravel` (server adapter), `../inertia-live-docs`, `../inertia-live-tooling` (release script, reusable workflows, Claude plugin).

## Rules for this repo

- **Never tag, push tags or publish manually.** Releases go through the release workflow (see the policy). `release.yml` still exists and publishes on a `v*` tag until the new workflows land.
- **Client packages are lockstep:** `core`, `vue` and `react` always share one version.
- **Changelog:** every user-visible change adds an entry under `## Unreleased` in `CHANGELOG.md` (add the section if missing). Server changes are tracked in the Laravel repo's changelog.
- **Wire-protocol changes** (signal shape, `_live` read, cursor or version semantics, `X-Socket-ID`) must be made together with `../inertia-live-laravel` and the spec in the docs repo. Do not change one side alone. While pre-1.0, a breaking protocol change bumps the minor on both sides.
- Behavior changes update the matching doc in the docs repo in the same piece of work. Guides live in versioned folders there (`v1/...`); link to them as `.../inertia-live-docs/blob/main/v1/<file>.md`.
- `/docs/` is gitignored: generated specs and plans stay local. Put anything that must survive in the decision log, a README or this file.
- Match the surrounding code's style and comment density; Biome enforces formatting.
- **No AI attribution** anywhere: no `Co-Authored-By` trailers, no "Generated with" footers, no mentions in commits, PRs, changelogs, docs or code comments.

## Status

The packages are at 0.1.x and the 1.0 scope is decided (D-011), but no API is frozen until the contract phase lists it; check `roadmap.md`.

## Keeping the tracker in sync

Tracker: https://claude.ai/artifact/PjKwna6Tty3ZnZFKneBjhT. Update it whenever you finish, start, block or add work, or record a decision or note, in the same piece of work. Never create a second tracker artifact.

- **State** (phases, tasks, decisions, notes) lives in the artifact's database. Use the `ArtifactData` tool with the tracker URL; pin writes to documents you have read (`if_version`). Task ids are stable slugs (`t-...`); statuses are `todo`, `doing`, `done`, `blocked`.
- **Page text or layout:** read the artifact (`Artifact` with `action: "read"` and the URL) to get its current HTML, change it, and publish with `url` set so the link stays the same.
- **Order:** docs repo first (`decision-log.md`, `roadmap.md`, `release-policy.md`), then the tracker. The docs win on conflict.
