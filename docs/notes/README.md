# Study notes

Deep dives on the concepts each phase of the roadmap exercises — written as the phases are built. These complement the [ADRs](../adr): ADRs record *decisions*, notes record *understanding*.

## Index

- [Phase 1 — Work Orders service](phase-1-work-orders.md): UUID vs serial keys, pg ENUM vs CHECK, state machines, cross-service references, offset vs cursor pagination, testing strategy
- [Phase 2 — Event-driven architecture](phase-2-event-driven.md): events vs commands, topic routing, at-least-once + idempotency, the dual-write problem, TTL retry + DLQ, testing messaging
