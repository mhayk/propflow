# ADR-0003: TypeORM over Prisma

- **Status**: Accepted
- **Date**: 2026-07-21

## Context

The Work Orders service needs PostgreSQL access with migrations, testability, and clean integration with NestJS. The main contenders in the Node/TypeScript ecosystem are TypeORM and Prisma.

## Options considered

### 1. Prisma

Schema-first: models are declared in a dedicated `schema.prisma` DSL and a fully typed client is generated from it.

- ✅ Best-in-class query type safety — results and filters are typed end-to-end without manual annotations.
- ✅ `prisma migrate` diffs the schema and generates migrations automatically.
- ✅ Excellent DX (Studio, formatting, introspection).
- ❌ A second source of truth outside TypeScript; the generated client is a build artifact every service build depends on.
- ❌ Doesn't map naturally onto Nest's decorator/DI idiom — repositories must be hand-rolled around a global client.
- ❌ Auto-generated migrations encourage not reading the SQL; fine-grained control (CHECK constraints, partial indexes) means dropping to raw SQL escape hatches anyway.

### 2. TypeORM (chosen)

Code-first: entities are TypeScript classes with decorators; repositories are injectable.

- ✅ First-class NestJS integration (`@nestjs/typeorm`): `forFeature` repositories slot directly into DI and are trivial to mock in unit tests.
- ✅ Migrations are plain TypeScript running arbitrary SQL — the CHECK constraints and invariants in our schema are written and reviewed as SQL.
- ✅ One language, one source of truth; no generation step.
- ❌ Weaker query-level type safety than Prisma (e.g. string-keyed relations in query builder).
- ❌ Historically rough API edges (the 0.2 → 0.3 breaking migration; now stabilised in 1.x).

## Decision

TypeORM, with two house rules: `synchronize` is always off (schema changes only through reviewed, hand-written SQL migrations), and entity/migration lists are explicit imports rather than glob paths (globs break under webpack bundling and jest).

## Consequences

- Unit tests mock the injected repository token; no database or generated client needed.
- Migrations are the single schema authority and encode invariants the ORM cannot express (e.g. `status = 'assigned' ⇒ assignee_id IS NOT NULL`).
- If query-heavy read models emerge later, a typed query layer (Kysely) can be added for those paths without replacing the ORM.
