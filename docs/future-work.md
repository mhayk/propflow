# Known limitations & planned work

The [ADRs](adr/README.md) record the trade-offs behind what *is* built; this page consolidates the deliberate gaps — what isn't built yet and why — so "what would you add next?" has one honest answer. Nothing here is an oversight; each is a boundary drawn on purpose, with the trigger that would justify closing it.

## Technician registry & assignment — the next natural increment

**Today**, assigning a technician (`PATCH /work-orders/:id/assign`) stores an opaque `assigneeId` UUID on the work order and flips it to `assigned` — that's all:

- there is **no technicians (or users) entity** anywhere in the domain;
- the `assigneeId` is **not validated** against anything — any UUID is accepted;
- there is **no way to answer "who is working on what"** through the API: `GET /work-orders` filters by `status`, `priority` and `propertyId`, but **not by `assigneeId`**;
- the JWT **`technician` role and the `assigneeId` are disconnected** — the role gates *permission* (a technician may change status), while `assigneeId` is just data on the row. Nothing links the logged-in technician (`sub`) to the UUID they were assigned.

This is the same "reference by id, no foreign key" pattern the system already uses for `propertyId` ([ADR-0001](adr/0001-nestjs-monorepo.md)) — a pointer to an entity that lives elsewhere, except that "elsewhere" (a technician service) does not exist yet. The system knows *that* someone was assigned; it cannot say *who*.

**What closing this gap needs:**

1. A **Technicians (or Users) service/entity** as the source of truth for who technicians are — mirroring the Properties service.
2. `assign` **validating** the `assigneeId` against it (exists? available? has the technician role?).
3. An **`assigneeId` filter** on `GET /work-orders`, and/or a **"my work orders"** endpoint derived from the JWT `sub`, so a technician sees their own workload.
4. Optionally a **roster / workload view** (open work orders per technician) for managers.

**Trigger:** the moment assignment needs to be more than a label — validation, technician-facing views, or workload balancing. Until then, the opaque reference keeps the work-orders service free of a user domain it doesn't yet own.

## Other known gaps

Each is discussed where the relevant decision was made; this table is the index.

| Gap | Why deferred | Discussed in |
| --- | --- | --- |
| **Refresh tokens / revocation** | Stateless 1h JWT, re-login; no denylist | [ADR-0008](adr/0008-authentication.md) |
| **Resource-level authorization** | Coarse roles — a tenant can read any work order, not only their own | [phase-8 notes](notes/phase-8-auth.md) |
| **Distributed tracing (OTel / Cloud Trace)** | Correlation ids answer "which logs belong to this request" at this size | [ADR-0005](adr/0005-observability-stack.md) |
| **Outbox retention job** | Published rows accumulate; prunable by `published_at` | [ADR-0007](adr/0007-outbox-pattern.md) |
| **Circuit breaker** | Gateway fails fast per request but never opens a circuit | [ADR-0009](adr/0009-service-discovery.md) |
| **LLM eval harness / observability** | Prompt/model changes ship without a regression score — where Langfuse would fit | [ADR-0010](adr/0010-direct-sdk-over-llm-frameworks.md) |
| **Notification recipient resolution** | Recipients are deterministic placeholders (`manager-of-…`, `tenant-of-…`) | [phase-2 notes](notes/phase-2-event-driven.md) |
| **Properties emits no events** | The properties service is read/write only; a second producer needs its own outbox | [services map](services.md#properties-the-quiet-registry-3003) |

## How to read this list in review

Every entry follows the same discipline the codebase applies to infrastructure: adopt complexity when the use case demands it, not speculatively. The technician registry is first because it's the closest to justified — it's the natural next domain the system would grow into, and the reference-by-id seam is already in place to receive it.
