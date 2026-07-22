# ADR-0007: Transactional outbox with a polling relay

- **Status**: Accepted
- **Date**: 2026-07-22

## Context

Since phase 2 every ADR touching events has carried the same footnote: publishing is best-effort, because the state change (a DB transaction) and the event publish (a broker call) are two writes that cannot be made atomic across systems — the **dual-write problem**. A crash between them loses the event: notifications never fire, triage never runs, the audit log silently misses a state change. Phase 7 closes this gap.

## Decisions

### Transactional outbox over the alternatives

1. **Publish-then-save / save-then-publish (status quo)**: simple, loses events. Rejected — the whole point of the phase.
2. **Distributed transactions (2PC)** across Postgres and RabbitMQ: neither broker nor common client libraries support it well; couples availability of both systems. Rejected.
3. **CDC / Debezium** tailing the WAL: the industrial-strength answer, but it brings Kafka Connect infrastructure and its own operational surface — outsized for this system.
4. **Transactional outbox (chosen)**: the event is written to an `outbox_events` table *in the same local transaction* as the state change. Atomicity comes for free from Postgres; a relay moves staged rows to the brokers afterwards.

### Polling relay with `FOR UPDATE SKIP LOCKED`

The relay polls the unpublished tail (partial index keeps the scan O(tail)), claims a batch with `FOR UPDATE SKIP LOCKED`, publishes to RabbitMQ **and** the Kafka audit stream, then stamps `published_at` in the same claiming transaction. Properties that follow:

- **Multi-instance safe**: two replicas' relays skip each other's locked rows — horizontal scaling needs no leader election (the k8s manifest runs 2 replicas to prove it).
- **Crash safe**: a relay dying mid-batch rolls back its `published_at` stamps; the rows are re-claimed on the next tick.
- **At-least-once, never at-most-once**: a crash *after* publish but *before* commit re-publishes. That is the correct trade — every consumer in the system dedupes by `eventId` (audit's `ON CONFLICT`, triage's `triaged_at`, notifications' processed-events store).

### The Kafka audit producer now throws

Best-effort audit made sense when the write path called it; under the outbox the relay is the caller and a failure must leave the row staged. Kafka delivery inherits the outbox's retry for free — the "audit can miss events" caveat from ADR-0006 is gone.

### Ordering

Rows are relayed in `id` order, so one aggregate's events keep their order under a single relay. With multiple relay instances, cross-batch interleaving can reorder events of *different* aggregates (harmless) and, rarely, of the same aggregate under contention — consumers that care key on the Kafka partition (ordered per aggregate) rather than RabbitMQ delivery order.

## Consequences

- `POST /work-orders` no longer talks to any broker: brokers can be down and writes still succeed; events drain when they return.
- Publish latency gains up to one poll interval (`OUTBOX_POLL_MS`, default 500ms) — irrelevant for this domain, tunable where it isn't.
- The outbox table grows forever; published rows are prunable by `published_at` (a retention job is deliberately left out at this scale).
- End-to-end delivery is now exactly-once *in effect*: at-least-once transport + idempotent consumers at every hop.
