# Phase 7 — Production hardening: outbox, idempotency, Kubernetes

## The dual-write problem, finally closed

A service that saves to its DB and publishes to a broker performs two writes with no shared transaction. Whatever the order, a crash between them produces either a lost event or a phantom event. Phases 2–6 shipped with this documented as a known gap; the **transactional outbox** removes it: the event is INSERTed into `outbox_events` inside the same Postgres transaction as the state change. One commit, both facts — or neither.

The subtlety worth internalizing: the outbox doesn't remove the second write, it *moves* it to a place where failure is harmless. The relay's publish can fail forever and nothing is lost — the row just stays staged.

## The relay: a queue disguised as a table

`SELECT ... WHERE published_at IS NULL ORDER BY id LIMIT n FOR UPDATE SKIP LOCKED` is the whole trick:

- `FOR UPDATE` claims rows transactionally.
- `SKIP LOCKED` makes concurrent relays partition the work instead of blocking on each other — multi-instance safety without leader election. This same idiom is how Postgres-backed job queues (pg-boss, good_job, Oban) work; the outbox is a special case of "Postgres as a queue".
- The partial index (`WHERE published_at IS NULL`) keeps the poll indexed on the tail regardless of history size.

Marking `published_at` in the claiming transaction gives crash-safety: die mid-batch and the stamps roll back, the rows get re-claimed. The price is publish-then-crash-before-commit → duplicate publish. That's the fundamental theorem of messaging showing up again: **you choose at-least-once or at-most-once; exactly-once transport doesn't exist**. You buy "exactly-once *in effect*" by pairing at-least-once transport with idempotent consumers.

## Idempotency as a system property

After this phase every hop dedupes, each with the technique that fits its storage:

| Consumer | Guard | Technique |
| --- | --- | --- |
| Audit projection | `event_id` unique | `INSERT ... ON CONFLICT DO NOTHING` (DB-enforced) |
| Triage | `triaged_at IS NULL` | natural-state check (the row itself records completion) |
| Notifications | processed-events store | explicit dedup memory, marked *after* the side effect |

The notifications one is the interesting lecture: its side effect (an email) leaves no queryable trace, so it needs dedicated memory. Mark-before-send loses a notification on crash; mark-after-send duplicates one — for notifications, duplicate beats lost. And the store is in-memory, which is honest only with one replica; the production upgrade (Redis `SETNX`, or a DB unique insert) changes the store, not the seam.

## Kubernetes: encoding phase 4's semantics in manifests

The probes were built in phase 4; k8s is where they acquire consequences. **Liveness** (`/health`, no dependency checks) restarts a wedged process — checking the DB here would turn a DB blip into a restart storm. **Readiness** (`/health/ready`) gates Service endpoints — a pod that can't reach its dependencies stops receiving traffic but keeps running. Graceful shutdown completes the loop: SIGTERM → Nest lifecycle hooks → consumers/relay/broker connections close → in-flight messages finish instead of being dropped and redelivered.

Two manifests are load-bearing documentation: `work-orders: replicas: 2` proves the relay is horizontally safe (SKIP LOCKED), and `notifications: replicas: 1` admits the in-memory dedup store's limit. Reading replica counts as claims about state is a good habit.

Deliberately absent: StatefulSets for Postgres/RabbitMQ/Kafka. Stateful infra in production comes from operators (CloudNativePG, Strimzi) or managed services; hand-rolled StatefulSets teach the wrong lesson.

## One image, five services

The parameterized multi-stage Dockerfile (`--build-arg APP=...`) is the monorepo's deployment dividend: one build recipe, `npm prune --omit=dev` after compiling, non-root runtime user, and the webpack bundle per app. The image differs only in which `dist/` it carries.

## Honest limitations (worth volunteering in review)

- The outbox covers the work-orders service only — the properties service has no events yet, but a second producer would need its own outbox (it's per-database by nature).
- No outbox retention job; `published_at` rows accumulate.
- Same-aggregate ordering under *multiple* relay instances isn't strictly guaranteed across batches; the Kafka side is ordered per aggregate by partition key, RabbitMQ consumers here don't depend on order.
- Migrations still run on app boot; with >1 replica racing, Postgres advisory locks in TypeORM make it safe-ish, but a pre-deploy migration job is the grown-up answer.
- No HPA, PodDisruptionBudgets, or NetworkPolicies — the manifests are a foundation, not a hardening checklist completed.
