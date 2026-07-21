# ADR-0005: Observability stack — pino, ALS request context, prom-client

- **Status**: Accepted
- **Date**: 2026-07-21

## Context

Phase 4 needs structured logging with correlation ids, metrics, and health probes across four services, with as little per-service ceremony as possible (everything shared lives in `libs/observability`).

## Decisions

### pino (via nestjs-pino) over winston / Nest's default logger

- pino writes newline-delimited JSON with near-zero overhead (serialization off the hot path); winston's transport pipeline is more flexible but markedly slower and defaults to unstructured strings.
- `nestjs-pino` gives request-scoped logging (one line per request with latency and status) and replaces the Nest logger, so framework logs land in the same JSON stream.
- Pretty-printing is a *development pipe* (`| pino-pretty`), never a production concern.

### AsyncLocalStorage request context over request-scoped providers

The request id must be readable anywhere on the async path (event publisher, downstream HTTP client) without appearing in every method signature. Options:

1. **Request-scoped Nest providers** (`Scope.REQUEST`): re-instantiates the provider subtree on every request — measurable cost, and it spreads virally (anything injecting a request-scoped provider becomes request-scoped).
2. **`nestjs-cls`**: a fine library, but it wraps exactly what `AsyncLocalStorage` already does.
3. **Hand-rolled ALS module (chosen)**: ~30 lines, zero dependencies, explicit semantics. First middleware in the stack opens the context; `currentRequestId()` reads it from any depth.

### prom-client with a per-app registry (pull model)

- Prometheus's pull model: services expose `/metrics`, the scraper aggregates. No push-gateway infrastructure, and a dead service is *visible* as a failed scrape.
- One `Registry` per app instead of the global default: multiple apps co-hosted in one process (the full-stack test suite) would otherwise collide on metric registration.
- One histogram (`http_request_duration_seconds`) with `method`, **route template** and `status_code` labels — counts and error rates are derivable from the histogram's `_count`, so a separate counter is redundant.

### What was deliberately NOT added: distributed tracing

Correlation ids answer "which log lines belong to this request" — grep-level tracing. OpenTelemetry spans would add timing waterfalls and cross-service parent/child structure at the cost of SDK wiring, a collector, and a backend (Jaeger/Tempo). For this system's size, correlation ids deliver most of the value; OTel is the documented next step and its insertion points (middleware, DownstreamClient, publisher/consumer) are exactly where the current code already touches.

## Consequences

- Every service logs JSON tagged with `name` (service) and `reqId`; a single grep for a request id reconstructs a user action across the gateway, both services, the broker envelope (`correlationId`) and the consumer.
- Adding observability to a future service is three lines: `LoggerModule.forRoot(buildLoggerOptions(...))`, `MetricsModule.forRoot(...)`, `app.use(requestContextMiddleware)`.
