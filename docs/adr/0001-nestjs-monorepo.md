# ADR-0001: NestJS monorepo over polyrepo

- **Status**: Accepted
- **Date**: 2026-07-21

## Context

PropFlow is composed of multiple services (API gateway, work orders, properties, notifications) that share TypeScript types, event contracts, and tooling. We need to decide how to organise the codebase: one repository per service (polyrepo) or a single repository containing all services (monorepo).

## Options considered

### 1. Polyrepo (one repo per service)

- ✅ Hard ownership boundaries; teams can version and deploy fully independently.
- ✅ Smaller checkouts, per-repo access control.
- ❌ Sharing event contracts/types requires publishing versioned packages — heavy ceremony for a small team.
- ❌ Cross-cutting changes (e.g. renaming an event) span multiple PRs that must be sequenced.
- ❌ Duplicated tooling: lint, CI, tsconfig drift over time.

### 2. Monorepo with NestJS workspace mode (chosen)

- ✅ Shared libraries (`libs/`) for event contracts and DTOs are plain imports — a breaking contract change fails the build of every affected service *immediately*, at compile time.
- ✅ One toolchain: single `package.json`, one CI pipeline, atomic cross-service refactors.
- ✅ Each app still builds to an independent artifact and deploys as its own container — monorepo is a *code organisation* choice, not a deployment one.
- ❌ Single dependency tree: services can't diverge on library versions (also arguably a feature).
- ❌ CI needs path filtering as the repo grows, or every commit builds everything.

## Decision

Use NestJS monorepo mode: each service under `apps/`, shared contracts under `libs/`.

## Consequences

- Event schemas and DTOs will live in `libs/contracts` and be imported by producer and consumer — contract drift is caught at compile time instead of in production.
- Deployment independence must be preserved deliberately: each app gets its own Dockerfile and can be deployed separately even though code is co-located.
- If the team grew significantly, extraction to polyrepo remains possible because service boundaries are enforced at the module level (no service imports another service's internals — only `libs/`).
