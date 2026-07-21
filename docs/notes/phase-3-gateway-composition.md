# Phase 3 — API Gateway, service composition and inter-service communication

## Why a gateway at all

Clients would otherwise need to know every service's address, handle each one's auth, and make N calls for one screen. The gateway gives a single entry point (`/api/*`) and one place for cross-cutting concerns (auth, rate limiting, request logging — later phases). Trade-offs acknowledged:

- It's an extra hop and a potential single point of failure → keep it thin and stateless (scale horizontally).
- One gateway serving very different clients (web, mobile, partners) eventually wants splitting into **BFFs** (backend-for-frontend). One client type today ⇒ one gateway.

## Sync vs async: where each belongs

The system now uses both deliberately:

- **Queries** (get property, list work orders) are synchronous HTTP through the gateway — the caller needs the answer *now*.
- **Side effects** (notify on creation) are asynchronous events — nobody is waiting, and the producer must not depend on consumers.

Rule of thumb: if the caller can't proceed without the response, it's a sync call; if it could be done later without the caller noticing, it's an event.

## Downstream call policy (DownstreamClient)

- **Hard timeout (3s)** on every call. Without it, one slow service consumes gateway sockets until everything is down — the classic cascading failure. Fail fast, free the resources.
- **Error pass-through**: downstream 4xx bodies (validation messages, 404s, 409s) reach the client untouched. The gateway adds no opinion about errors it didn't produce.
- **Transport translation**: timeout → `504`, connection refused → `502`. The client can distinguish "service slow" from "service gone" from "you sent garbage".
- Next steps on this path (hardening phase): retries with jitter for idempotent GETs, circuit breaker so a dead service isn't hammered, per-service bulkheads.

## Composition and graceful degradation

`GET /api/properties/:id/summary` fans out to both services **in parallel** (`Promise.all` — latency is `max(a,b)`, not `a+b`) and applies a per-dependency policy:

- The **property** is the primary resource — if it's missing or its service is down, the request fails honestly.
- The **work orders** are enrichment — if unavailable, the response degrades: `workOrders: null, workOrdersAvailable: false`. Partial data beats a blank screen.

That per-dependency decision (fail vs degrade) is the design conversation; `Promise.all` is just the syntax.

## Validation lives with the data owner

The gateway validates only what it owns (path shape, UUID params). Payload rules stay in the owning service — duplicating them in the gateway means every rule change deploys two apps, and they *will* drift. The pass-through error policy is what makes this ergonomic: the service's field-level messages arrive intact.

## No DB-level check that propertyId exists

Creating a work order does not call the Properties service to verify the property exists. Deliberate: a sync check couples Work Orders' availability to Properties' and still races with deletion. Options ranked: accept + reconcile via events (current), async validation marking orders orphaned, or sync check with the coupling cost. In a real product this is a product decision as much as a technical one.

## Testing the composition

The full-stack e2e boots the *real* Work Orders and Properties apps on ephemeral ports inside the test process, points the gateway's clients at them via env, and exercises creation, error pass-through (400/409), composition — then kills a service mid-suite and asserts the summary degrades instead of failing. Cross-app imports are banned in `src/`; the system test is the deliberate exception, because its subject IS the composition.
