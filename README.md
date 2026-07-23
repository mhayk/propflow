# PropFlow

<p align="center">
  <a href="https://github.com/mhayk/propflow/actions/workflows/ci.yml"><img src="https://github.com/mhayk/propflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mhayk.github.io/propflow/coverage/"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fmhayk.github.io%2Fpropflow%2Fcoverage%2Fbadge.json" alt="Unit coverage"></a>
  <a href="https://mhayk.github.io/propflow/"><img src="https://img.shields.io/badge/docs-live-2ea44f?style=flat&logo=materialformkdocs&logoColor=white" alt="Docs"></a>
  <a href="docs/adr"><img src="https://img.shields.io/badge/ADRs-10-blue?style=flat" alt="ADRs"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white" alt="RabbitMQ">
  <img src="https://img.shields.io/badge/Apache%20Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white" alt="Apache Kafka">
  <img src="https://img.shields.io/badge/Claude-D97757?style=for-the-badge&logo=claude&logoColor=white" alt="Claude">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" alt="Kubernetes">
</p>

A property maintenance management platform built as a **NestJS monorepo** with a **microservices, event-driven architecture** — RabbitMQ for work distribution, Kafka for the audit stream, LLM-powered triage, a transactional outbox, JWT auth, and full test coverage from unit to full-stack e2e.

This repository doubles as a living study project: every architectural decision is documented as an [ADR](docs/adr) with its trade-offs, and each phase of the roadmap focuses on one production concern (messaging, observability, resilience, AI integration).

## Domain

Property managers handle a constant stream of maintenance requests: a tenant reports a leaking tap, the request must be triaged, assigned to a contractor, tracked to completion, and everyone involved must be notified along the way. PropFlow models that flow:

- **Work Orders** — the core aggregate: maintenance requests and their lifecycle (`open → assigned → in_progress → completed`), with async LLM triage (category + urgency).
- **Properties** — buildings and units that work orders belong to.
- **Notifications** — reacts to domain events (e.g. `work-order.created`) asynchronously.
- **Audit** — projects the Kafka event stream into a queryable activity feed.

## Architecture

```mermaid
flowchart LR
    Client([Client]) --> GW[API Gateway]
    GW --> WO[Work Orders Service]
    GW --> PR[Properties Service]
    GW --> AU[Audit Service]
    WO -->|domain events| MQ[(RabbitMQ)]
    WO -->|audit stream| KF[(Kafka)]
    MQ -->|created events| WO
    WO -.->|triage| AI[Anthropic API]
    MQ --> NT[Notifications Service]
    KF --> AU
    WO --> DB1[(PostgreSQL)]
    PR --> DB2[(PostgreSQL)]
    AU --> DB3[(PostgreSQL)]
```

Each service owns its data (database-per-service). Services communicate synchronously through the gateway for queries and asynchronously through domain events for side effects — no service calls another service's database directly.

## Tech stack

| Layer | Stack | Why / decisions |
| --- | --- | --- |
| Runtime & language | ![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | Strict mode, monorepo path aliases |
| Framework | ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white) | Monorepo mode, one app per service — [ADR-0001](docs/adr/0001-nestjs-monorepo.md) |
| Data | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![TypeORM](https://img.shields.io/badge/TypeORM-FE0803?style=flat-square&logo=typeorm&logoColor=white) | Database-per-service, reviewed migrations — [ADR-0003](docs/adr/0003-typeorm-over-prisma.md) |
| Messaging | ![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white) ![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-231F20?style=flat-square&logo=apachekafka&logoColor=white) | Queue for fan-out, log for replayable history — [ADR-0002](docs/adr/0002-rabbitmq-first-kafka-later.md), [ADR-0004](docs/adr/0004-golevelup-rabbitmq-over-nest-transport.md) |
| Reliability | ![Transactional outbox](https://img.shields.io/badge/Transactional%20outbox-2D3748?style=flat-square) ![Idempotent consumers](https://img.shields.io/badge/Idempotent%20consumers-2D3748?style=flat-square) | Dual-write closed, at-least-once end to end — [ADR-0007](docs/adr/0007-outbox-pattern.md) |
| AI | ![Claude](https://img.shields.io/badge/Anthropic%20Claude-D97757?style=flat-square&logo=claude&logoColor=white) | Async LLM triage, structured outputs, best-effort — [ADR-0006](docs/adr/0006-llm-triage.md) |
| Auth | ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) | Verified once at the edge, roles per route, actor in every event — [ADR-0008](docs/adr/0008-authentication.md) |
| Observability | ![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=flat-square&logo=prometheus&logoColor=white) ![Pino](https://img.shields.io/badge/Pino-687634?style=flat-square) | RED metrics, JSON logs, correlation ids via ALS — [ADR-0005](docs/adr/0005-observability-stack.md) |
| Testing | ![Jest](https://img.shields.io/badge/Jest-C21325?style=flat-square&logo=jest&logoColor=white) ![Supertest](https://img.shields.io/badge/Supertest-2D3748?style=flat-square) | 70+ unit tests, e2e per service, full-stack composition suite — [coverage report](https://mhayk.github.io/propflow/coverage/) |
| Infra & CI | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat-square&logo=kubernetes&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white) | Compose for dev, manifests + NetworkPolicies in [k8s/](k8s) |
| API & docs | ![OpenAPI](https://img.shields.io/badge/OpenAPI-85EA2D?style=flat-square&logo=swagger&logoColor=black) ![AsyncAPI](https://img.shields.io/badge/AsyncAPI-4B4FCE?style=flat-square) ![Mermaid](https://img.shields.io/badge/Mermaid-FF3670?style=flat-square&logo=mermaid&logoColor=white) ![Material for MkDocs](https://img.shields.io/badge/MkDocs%20Material-526CFE?style=flat-square&logo=materialformkdocs&logoColor=white) | Swagger at `/api/docs`, [AsyncAPI rendered](https://mhayk.github.io/propflow/asyncapi/), [hosted docs site](https://mhayk.github.io/propflow/) |

## Getting started

```bash
# infrastructure (PostgreSQL + RabbitMQ + Kafka)
docker compose up -d

# install & run (one terminal per service)
npm install
npm run start:dev work-orders-service    # :3001
npm run start:dev notifications-service  # :3002
npm run start:dev properties-service     # :3003
npm run start:dev audit-service          # :3004
npm run start:dev api-gateway            # :3000 — public entry point (/api/*)

# tests
npm test          # unit
npm run test:e2e  # end-to-end
```

RabbitMQ management UI: http://localhost:15672 (propflow / propflow).

Every business route requires a JWT. Log in with a demo user (see `.env.example` to customize):

```bash
curl -s -X POST localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"manager@propflow.dev","password":"propflow"}'
# -> { "accessToken": "...", "role": "manager" }  — send as Authorization: Bearer <token>
```

## Live demo

With the stack up (and `ANTHROPIC_API_KEY` set for the work-orders service), one command drives the whole platform through the gateway and narrates each step:

```bash
npm run demo
```

It authenticates, opens a work order whose tenant **understates** the priority as `medium`, and shows the LLM re-evaluating it to `emergency` — then runs the state machine and prints the audit feed with every event attributed (human vs. `system (AI)`). It's the fastest way to see auth, the state machine, the transactional outbox, both brokers, the audit projection and AI triage working end to end.

![PropFlow live demo](docs/assets/demo.gif)

> Recorded with [VHS](https://github.com/charmbracelet/vhs) from a real run — regenerate with `vhs scripts/demo.tape`.

<details>
<summary>Sample run (text)</summary>

```text
PropFlow — live demo  (http://localhost:3000/api)
    OK  gateway healthy

==> 1. Authenticate (role: manager)
    OK  JWT issued (eyJhbGciOiJIUzI1NiIs...)
    OK  request without a token -> 401 (auth is enforced)

==> 2. Register a property
    OK  propertyId c6e716a1-425e-4e8f-ac01-683e5a0418db

==> 3. Open a work order — tenant reports priority: medium
    "strong smell of gas in the kitchen and the boiler is dead in winter"
    OK  workOrderId df0a1cd0-5255-4efb-836e-897fd02b0d15  (returns immediately — triage is async, off the write path)

==> 4. AI triage (LLM -> outbox -> Kafka), waiting...
    OK  classified in ~4s
    category   hvac
    urgency    emergency  (the LLM raised it from the tenant's "medium")
    reasoning  A strong gas smell poses an active danger of fire or explosion, and combined with no heat in winter this is a life-safety emergency regardless of the tenant's stated priority.

==> 5. Lifecycle transitions (guarded by the state machine)
    OK  assign -> 200
    OK  in_progress -> 200
    OK  invalid in_progress->open -> 409 (rejected, as it should be)

==> 6. Activity feed — audit projection of the Kafka log
    work-order.started     by manager@propflow.dev
    work-order.assigned    by manager@propflow.dev
    work-order.triaged     by system (AI)
    work-order.created     by manager@propflow.dev

==> What just happened
    1 request -> state + event committed atomically (outbox), never lost
    outbox relay -> RabbitMQ (notifications) + Kafka (audit), at-least-once
    AI triage ran async and re-evaluated the priority, attributed as 'system'
    every action is auditable end to end, with who did it

done.
```

</details>

## Roadmap

Each phase is a self-contained increment with tests and documentation.

- [x] **Phase 0 — Foundations**: monorepo scaffold, Docker Compose (PostgreSQL + RabbitMQ), CI, ADR structure
- [x] **Phase 1 — Work Orders service**: REST API, PostgreSQL + data modelling, validation, unit + e2e tests
- [x] **Phase 2 — Event-driven core**: domain events over RabbitMQ, Notifications consumer, retries + dead-letter queue
- [x] **Phase 3 — Properties service + API Gateway**: service composition, inter-service communication patterns
- [x] **Phase 4 — Observability**: structured logging, correlation ids, Prometheus metrics, liveness/readiness probes
- [x] **Phase 5 — Kafka**: event streaming for an audit/activity feed; RabbitMQ vs Kafka in practice
- [x] **Phase 6 — AI integration**: LLM-powered triage of maintenance requests (urgency + category classification)
- [x] **Phase 7 — Production hardening**: outbox pattern, idempotent consumers, Kubernetes manifests
- [x] **Phase 8 — Authentication & authorization**: JWT at the edge, role-based routes, identity propagated into the audit trail

## Documentation

**Hosted docs: [mhayk.github.io/propflow](https://mhayk.github.io/propflow/)** — same content, with rendered diagrams, navigation and search.

- [Services map](docs/services.md) — each service's mission, its world in a diagram, and its explicit non-responsibilities
- [Design patterns](docs/patterns.md) — catalog of the patterns used (architectural, messaging, application) and the ones deliberately not used
- [Running on GCP](docs/gcp.md) — a deployment study mapping the stack onto Google Cloud (GKE, Cloud SQL, Pub/Sub, Managed Kafka, Claude on Vertex AI) and how little code moves
- [API reference](docs/api.md) — every endpoint with its required role; interactive OpenAPI ([Scalar](https://scalar.com)) at `/api/docs` when running, [rendered statically here](https://mhayk.github.io/propflow/api-reference/)
- [Postman collection](docs/postman/PropFlow.postman_collection.json) — import and call every endpoint; login auto-saves the token, create-requests chain the ids
- [Event catalog](docs/events.md) — the async contract: envelope, every event with producers/consumers, broker topology, delivery guarantees; formal [AsyncAPI spec](asyncapi.yaml) validated in CI and [rendered on the docs site](https://mhayk.github.io/propflow/asyncapi/)
- [Architecture Decision Records](docs/adr) — every significant decision and its trade-offs
- [Sequence flows](docs/flows.md) — how actors and services interact, flow by flow (auth, write path, outbox relay, event fan-out, AI triage, retries/DLQ, composition, activity feed)
- [Study notes](docs/notes) — deep dives on the concepts each phase exercises
- [Unit coverage report](https://mhayk.github.io/propflow/coverage/) — line-by-line, republished on every push; the badge above tracks it. Unit scope only: the gateway's HTTP surface is exercised by the e2e suites, which don't count here
