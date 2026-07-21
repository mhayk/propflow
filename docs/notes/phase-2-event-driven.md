# Phase 2 — Event-driven architecture: RabbitMQ, retries, DLQ

Concepts exercised while wiring Work Orders → RabbitMQ → Notifications.

## Events vs commands

`work-order.created` is an **event**: a fact about the past, published without knowing (or caring) who listens. A **command** ("send this email") targets one handler and expects it to act. Events decouple producers from consumers — the Work Orders service gained a Notifications integration without a single line of its code changing. That asymmetry is the entire payoff of event-driven architecture.

## Topic exchange routing

One `propflow.events` topic exchange; routing keys form a namespace (`work-order.created`, `work-order.completed`...). Each consumer declares its *own* durable queue bound to the patterns it cares about:

- Queue-per-consumer-per-concern (`notifications.work-order-created`) — competing consumers on the same queue scale horizontally; *different* queues each get every matching message.
- A future consumer (say, an analytics service) binds `work-order.*` to a new queue and receives everything — no producer change.

## Delivery guarantees: at-least-once, therefore idempotency

With persistent messages, durable queues, and ack-after-processing, RabbitMQ guarantees **at-least-once** delivery: a crash between processing and ack means redelivery. Exactly-once does not exist across process boundaries — the practical stance is *at-least-once + idempotent consumers*. Every envelope carries an `eventId` precisely so consumers can deduplicate (a processed-event table arrives with the hardening phase).

## The dual-write problem

`create()` writes to PostgreSQL, then publishes to RabbitMQ — two systems, no shared transaction. Current choice: **best-effort publish** (log and continue on broker failure), because failing an HTTP request whose DB change already committed is worse than a lost notification. The correct fix is the **outbox pattern**: write the event into an `outbox` table in the same DB transaction as the state change; a relay publishes from that table. Deliberately deferred to Phase 7 — knowing *why* it's needed matters more than the code.

## Retry: the TTL/dead-letter trampoline

RabbitMQ has no native delayed retry, so we build one from primitives:

```
main queue ──handler fails── republish ──> main.retry   (TTL 5s, no consumers)
     ^                                          │ message expires
     └────── default exchange, rk = queue ──────┘
```

After `MAX_ATTEMPTS` (tracked in an `x-attempt` header) the message is parked in `<queue>.dlq` on the `propflow.dlx` exchange, keeping the last error in a header for forensics and manual replay.

Design details worth defending in review:

- **The original delivery is always acked.** Redelivery is an explicit *copy*; a poison message can never hot-loop the consumer at full CPU (which is what a bare `nack(requeue=true)` produces).
- Retry queues have **no consumers** — the broker itself is the timer.
- Dead-lettering via the **default exchange** (routing key = queue name) sends the retry back to exactly one queue, even if other consumers bind the same routing key on the events exchange.
- Trade-off: the TTL is fixed per queue. True exponential backoff needs one wait-queue per delay tier or the delayed-message plugin.

## Testing a messaging system

- **Unit**: handlers and the retry policy tested in isolation (`EventRetryHandler` mocks `AmqpConnection`; consumers get a pass-through retry stub).
- **e2e**: a real publish → exchange → binding → queue → consumer round-trip with the sender overridden by a recorder, polled with a timeout. Asserts the *topology* works, which unit tests structurally cannot.
- What's deliberately not tested: RabbitMQ's own TTL/dead-letter mechanics (that would test the broker, not our code).
