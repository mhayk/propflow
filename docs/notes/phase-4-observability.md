# Phase 4 — Observability: logs, metrics, probes, correlation

## The three pillars, and what each answers

- **Logs** — "what happened in this specific case?" (high detail, high cost to query at scale)
- **Metrics** — "how is the system behaving overall?" (cheap aggregates, no per-request detail)
- **Traces** — "where did this request spend its time across services?"

PropFlow implements structured logs + metrics + correlation ids; full tracing (OpenTelemetry) is documented as the next step in [ADR-0005](../adr/0005-observability-stack.md).

## Structured logging: why JSON lines

`grep`-able text logs break the moment you need "all 5xx for property X between 14:00 and 14:05". JSON logs make every field queryable in any log store. Rules applied here:

- One line per request (method, route, status, latency) — emitted by pino-http, not hand-written.
- Every line carries `name` (service) and `reqId`. No log line is anonymous.
- Probes and metric scrapes are **not** logged: at one probe per 10s per instance they would outnumber real traffic.
- Secrets are redacted at the logger level (`authorization` header), not by hoping call sites remember.

## Correlation ids: tracing on a budget

`x-request-id` is minted (or accepted) at the edge, stored in **AsyncLocalStorage**, echoed in the response, forwarded on every downstream HTTP call, and stamped into event envelopes as `correlationId`. One user action is now a single grep across every service — including through the broker, where the async hop would otherwise sever the trail.

Key detail: ALS makes the id ambient — the publisher deep inside the service reads it without any signature threading. That's the same mechanism (context propagation) OTel uses; we're just carrying one string instead of span structures.

## Metrics: RED and the cardinality trap

The histogram `http_request_duration_seconds{method, route, status_code}` yields the **RED** triad per endpoint: Rate (`_count` increase), Errors (filter `status_code=~"5.."`), Duration (histogram quantiles).

The trap: labels multiply time series. Route **template** (`/work-orders/:id`, bounded by endpoint count) is safe; raw URLs or user ids in labels would create unbounded cardinality and take the metrics store down. That single sentence is a favourite interview probe.

## Liveness vs readiness

- **Liveness** (`/health`): "the process is responsive." Fails → restart the container. It must NOT check dependencies: a dead database would otherwise restart-loop every service that depends on it.
- **Readiness** (`/health/ready`): "I can do useful work right now." Fails → take the instance out of the load balancer, don't restart it. Checks the DB (services), the broker connection (consumer), and downstream `/health` (gateway).

Conflating the two is a classic production incident: liveness checking the DB turns a database blip into a full restart storm.

## Honest limitations (worth volunteering in review)

- Nest interceptors don't see requests rejected before routing (bad JSON, 404s on unknown paths) — those escape the histogram. A raw middleware would catch them.
- The gateway's readiness aggregates *all* downstreams; with graceful degradation in place, an argument exists for "ready if the primary dependencies are up". Readiness semantics are a product decision.
- Logs, metrics and correlation ids still can't answer "which hop was slow" — that's the gap OTel spans would close.
