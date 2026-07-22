# Study notes

Deep dives on the concepts each phase of the roadmap exercises — written as the phases are built. These complement the [ADRs](../adr): ADRs record *decisions*, notes record *understanding*.

## Index

- [Phase 1 — Work Orders service](phase-1-work-orders.md): UUID vs serial keys, pg ENUM vs CHECK, state machines, cross-service references, offset vs cursor pagination, testing strategy
- [Phase 2 — Event-driven architecture](phase-2-event-driven.md): events vs commands, topic routing, at-least-once + idempotency, the dual-write problem, TTL retry + DLQ, testing messaging
- [Phase 3 — Gateway and composition](phase-3-gateway-composition.md): gateway vs BFF, sync vs async boundaries, timeouts and cascading failure, error pass-through, graceful degradation, cross-service referential integrity
- [Phase 4 — Observability](phase-4-observability.md): three pillars, structured logging rules, correlation ids via ALS, RED metrics and the cardinality trap, liveness vs readiness
- [Phase 5 — Kafka](phase-5-kafka.md): log vs queue, partitions and keys, consumer groups and replay, idempotent projections, push vs pull, keyset pagination in practice
- [Phase 6 — AI triage](phase-6-ai-triage.md): LLMs as components (nondeterminism/cost/latency), sync vs async AI, structured outputs, stubbing the model in tests, best-effort semantics, auditable AI decisions
- [Phase 7 — Production hardening](phase-7-hardening.md): the dual-write fix, SKIP LOCKED relays, idempotency per consumer, probes with consequences, replica counts as documentation
