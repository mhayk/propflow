# Phase 5 — Kafka: the audit stream and activity feed

## Log vs queue: the mental model that decides everything

RabbitMQ is a **queue**: a message is routed, delivered, acked, and *gone*. Kafka is a **log**: an append-only file per partition that consumers *read from an offset*; consuming deletes nothing. Every practical difference follows from this:

- **Replay**: point a new consumer group at offset 0 and the whole history streams back. A queue cannot do this — once acked, the message no longer exists.
- **Fan-out**: N consumer groups read the same log independently, each tracking its own offset. In RabbitMQ, fan-out is topology (one queue per consumer) decided at *publish* time; in Kafka a future consumer can subscribe to the past.
- **Backpressure**: consumers *pull* at their own pace; a slow consumer lags (measurable as offset lag) instead of blowing up broker memory.

PropFlow uses both deliberately ([ADR-0002](../adr/0002-rabbitmq-first-kafka-later.md)): RabbitMQ for transient work distribution (notifications, retries, DLQ), Kafka where history *is* the product (audit).

## Partitions, keys, and ordering

Kafka guarantees order only **within a partition**. The producer keys every event by `workOrderId`, so all events of one aggregate hash to the same partition and keep their order; global order across aggregates is not guaranteed and not needed. Choosing the partition key = choosing your ordering unit — an interview staple.

## Consumer groups and offsets

A group is a named cursor over the log. The broker stores "group X is at offset N per partition" and rebalances partitions across the group's members. Two takeaways exercised here:

- `fromBeginning: true` + a **fresh group id** = full rebuild of the projection. The audit e2e suite runs with a unique group per run precisely to exercise this backfill path on every test run.
- The same events flow to the notifications consumer (RabbitMQ) and the audit consumer (Kafka) without either knowing about the other.

## At-least-once, again — and the projection pattern

Offsets are committed *after* processing, so a crash between insert and commit redelivers the message: at-least-once, same contract as Phase 2. The consumer is an **idempotent projector**: `INSERT … ON CONFLICT (event_id) DO NOTHING` makes duplicates no-ops, which is what makes both redelivery *and* full replays safe. This is a tiny instance of event sourcing's read-model idea: the topic is the source of truth, the table a disposable projection.

## Push vs pull, visible in the tests

The RabbitMQ e2e had to poll "does the queue have a consumer yet?" before publishing — a topic exchange drops unroutable messages. The Kafka e2e needs no such dance: events produced before the group joins are simply read once it does, because the log retains them. The test structure itself demonstrates the broker semantics.

## The feed: keyset pagination in practice

The activity feed reads the projection with a cursor, as promised in the Phase 1 notes. The `bigserial` id is the cursor: `WHERE id < $cursor ORDER BY id DESC LIMIT n+1`. Offset pagination would drift under a append-heavy table (every new event shifts every page); the keyset pins the boundary to a row, and fetching `limit+1` answers "is there a next page" without a `COUNT` over the whole log. Note the key choice: services use UUIDs for public entities, but a single-writer append-only internal table is exactly where a serial key (monotonic, index-friendly, cursor-ready) shines.

## Honest limitations (worth volunteering in review)

- The producer is **best-effort**: a work-order write succeeds even if the Kafka append fails, so the audit stream can miss events. The fix is the outbox pattern — scheduled for Phase 7.
- Single-node KRaft with `replication.factor=1` is a dev topology; production needs 3+ brokers and `acks=all`.
- `eachMessage` commits per message; batching (`eachBatch`) would raise throughput at the cost of more redelivery on crash — irrelevant at this scale, worth knowing why.
- The audit table retains forever; a real system needs a retention/archival story on both the topic and the projection.
