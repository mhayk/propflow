# ADR-0002: RabbitMQ first, Kafka later

- **Status**: Accepted
- **Date**: 2026-07-21

## Context

Services communicate asynchronously through domain events (e.g. `work-order.created` triggers a notification). We need a message broker. The two dominant options are RabbitMQ (a traditional message broker) and Apache Kafka (a distributed event log).

## Options considered

### 1. RabbitMQ (chosen for the core messaging phase)

A *smart broker / dumb consumer* model: the broker routes messages through exchanges to queues and tracks delivery per message.

- ✅ Fits command-like, transient work (send a notification, process a job): per-message ack, automatic redelivery, dead-letter exchanges, priority, TTL.
- ✅ Flexible routing (topic/fanout/direct exchanges) without consumer-side logic.
- ✅ Lightweight to operate locally and in small deployments; first-class NestJS transport.
- ❌ Messages are gone once consumed — no replay for new consumers or reprocessing after a bug.
- ❌ Throughput ceiling below Kafka's for very high-volume streams.

### 2. Kafka

A *dumb broker / smart consumer* model: an append-only partitioned log; consumers track their own offsets.

- ✅ Events are durable and replayable — new consumers can rebuild state from history (event sourcing, audit feeds, analytics).
- ✅ Horizontal scale via partitions; ordering guaranteed per partition key.
- ❌ Operationally heavier (brokers + coordination), more concepts to hold (partitions, consumer groups, offsets, rebalancing).
- ❌ No per-message ack/redelivery semantics — retries and DLQs are consumer-side patterns you build yourself.

## Decision

Use **RabbitMQ** for inter-service domain events (Phase 2). Introduce **Kafka** in Phase 5 for the audit/activity feed — a use case that genuinely benefits from a replayable log — rather than replacing RabbitMQ.

## Consequences

- The Notifications flow gets production-grade delivery semantics (acks, retries, DLQ) with minimal infrastructure.
- The project ends up demonstrating *both* technologies applied to the use cases they fit best, and this ADR documents why neither is "better" in the abstract: **RabbitMQ for transient routing and work distribution; Kafka for durable, replayable event streams.**
- Event payload contracts live in `libs/contracts` from day one, so moving a flow between brokers later changes transport code, not business code.
