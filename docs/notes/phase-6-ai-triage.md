# Phase 6 — AI integration: LLM triage of maintenance requests

## An LLM is a component with unusual failure modes

Adding a model call to a backend is not an architecture change — it's a dependency with three properties most dependencies don't have: **nondeterministic output**, **per-call cost**, and **latency measured in seconds**. Every design decision in this phase falls out of taking those three seriously:

- Nondeterminism → constrain the output with a schema; never parse free text.
- Cost → classify once per order (idempotency guard), pin effort low, make the model configurable.
- Latency/availability → keep the call off the write path entirely.

## Sync vs async AI: why triage is an event consumer

The naive integration is `POST /work-orders` → call the model → save. That couples the endpoint's p99 and availability to a third party. The alternative used here: the service **reacts to its own `work-order.created` event**, the same one notifications already consume. The request returns immediately with `triagedAt: null`; the classification arrives when it arrives. This is the Phase 2/3 lesson (sync for queries, async for side effects) applied to AI: a classification is a side effect, so it goes on the event path.

## Structured outputs: the schema is the contract

`output_config.format` with a JSON schema turns "prompt engineering for parseable output" into an API guarantee — the response validates against the schema or doesn't come back. Two details matter:

- **Closed vocabularies via `enum`**: the schema's category/urgency lists are the same `TRIAGE_CATEGORIES`/`TRIAGE_URGENCIES` exported from `@app/contracts`. The model cannot invent a category, so downstream code treats triage like any other enum.
- The schema does not remove the need to handle **refusals** (`stop_reason: "refusal"`) or API failures — those are outcomes, not exceptions, and both map to "no classification".

## The abstraction seam: test the loop, stub the model

`TriageClassifier` is the same pattern as `NotificationSender`: an abstract class the consumer depends on, with the Anthropic implementation bound in production and a stub bound in tests. The e2e suite runs the entire distributed loop — HTTP → RabbitMQ → consumer → persist → `work-order.triaged` — with a deterministic classifier at the seam. **You test your plumbing, not the model's judgment**; prompt quality is evaluated separately (eval sets), not in CI, because asserting on live LLM output makes tests flaky and every CI run costs money.

## Best-effort AI: absence is a valid state

All triage columns are nullable and every failure degrades to `null` + a log line. This "advisory AI" stance sidesteps a whole class of problems: no retry/DLQ for the LLM call (re-running a paid nondeterministic call on redelivery is poor economics), no circuit breaker ceremony, no blocked work orders. The flip side is an honest gap: if the `created` event is lost (dual-write problem), the order is never triaged — Phase 7's outbox closes that.

## The AI decision is auditable

Applying a triage publishes `work-order.triaged` with the category, urgency and the model's one-sentence `reasoning` — through the normal publisher, so it lands in the Kafka audit stream. "Why did the system mark this as emergency?" is answerable by replaying the log, which matters the moment an AI decision affects a real dispatch.

## Prompt design notes

- The system prompt is **stable** (cache-friendly: static instructions first, per-request data in the user turn) and encodes domain calibration — what "emergency" means for a rental property.
- The tenant's own priority is passed as *a hint labeled as unreliable*, not as ground truth — tenants over- and under-state.
- The `reasoning` field is requested for auditability, not for chain-of-thought: one sentence, stored with the row.

## Honest limitations (worth volunteering in review)

- **Lost events mean no triage** — best-effort publish + best-effort consume; the outbox pattern (Phase 7) is the fix.
- **No eval harness**: prompt/model changes ship without a regression score. A real system keeps a labeled set of past requests and scores category/urgency accuracy per change.
- **No human-in-the-loop**: triage silently informs sorting. If it started driving dispatch or spend, an emergency-level classification would warrant confirmation flows.
- **Single-shot classification**: no retry-on-refusal, no fallback model. The API supports fallback chains; complexity wasn't justified for an advisory field.
