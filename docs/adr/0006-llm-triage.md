# ADR-0006: LLM triage as an event consumer inside the Work Orders service

- **Status**: Accepted
- **Date**: 2026-07-22

## Context

Phase 6 adds AI classification of maintenance requests: every new work order gets a category (plumbing, electrical, …) and an urgency level (emergency … low), so managers can sort the queue by something better than the tenant's self-reported priority. The classification is produced by an LLM (Anthropic Claude), which introduces three properties the rest of the system doesn't have: nondeterminism, per-call cost, and an external dependency that can be slow or down.

## Decisions

### Triage is asynchronous — a consumer of `work-order.created`, not part of the write path

Classifying inline in `POST /work-orders` would couple the request's latency and availability to a third-party API. Instead the triage module subscribes to the service's own domain event (the one that already fans out to notifications and the audit stream) and applies the result later. The HTTP response returns without triage; the columns fill in when the classification lands. This reuses the Phase 2 machinery instead of inventing a new trigger path.

### Inside the Work Orders service, not a separate triage service

The classification's only side effect is an update to the `work_orders` table, which this service owns. A separate triage-service would need write access to another service's data — either via HTTP back through the gateway (a circular dependency) or by sharing the database (forbidden by the architecture). A module inside the owning service keeps the data ownership rule intact; the LLM call is isolated behind an abstraction, not behind a network boundary it doesn't need.

### The provider sits behind a `TriageClassifier` abstraction

Same seam pattern as `NotificationSender`: the consumer depends on an abstract class, production binds `AnthropicTriageClassifier`, tests bind a stub. Swapping providers (or adding a rules-based fallback) touches one binding.

### Structured outputs with a closed vocabulary, not free-text parsing

The API's `output_config.format` (JSON schema with `enum`s) makes the model's response schema-valid by construction — the same categories and urgencies exported from `@app/contracts`. Consumers treat triage values like any other enum in the contract; there is no "the model said something weird" parsing layer.

### Best-effort semantics: absence of triage is a valid state

All triage columns are nullable and every failure mode — missing API key, rate limit, outage, model refusal — degrades to "no classification" (`null`), logged and skipped. No retry queue or DLQ: retrying a paid, nondeterministic call on redelivery buys little, and a work order without triage is fully functional. The `triaged_at` column doubles as the idempotency guard against duplicate `created` deliveries.

### The result is a domain event too

Applying a triage publishes `work-order.triaged` through the existing publisher, so it fans out to RabbitMQ subscribers and lands in the Kafka audit stream like every other state change — the AI's decision (including its one-sentence reasoning) is auditable and replayable.

## Consequences

- The write path is untouched: LLM downtime degrades a feature, not the service.
- Tests never call the real API; the e2e suite exercises the full publish→consume→classify→persist→re-publish loop with a deterministic stub at the provider seam.
- Cost control is configuration: the model is `TRIAGE_MODEL` (default `claude-opus-4-8`), effort is pinned low, and unsetting `ANTHROPIC_API_KEY` turns the feature off.
- A duplicate `created` event cannot double-triage (guarded by `triaged_at`), but a *lost* `created` event means no triage — accepted until the outbox pattern (Phase 7) closes the dual-write gap.
