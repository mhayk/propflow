# Architecture Decision Records

Every significant technical decision in this project is recorded here using the [ADR format](https://adr.github.io/): the context that forced a decision, the options considered, the decision itself, and the trade-offs accepted.

## Index

- [ADR-0001](0001-nestjs-monorepo.md) — NestJS monorepo over polyrepo
- [ADR-0002](0002-rabbitmq-first-kafka-later.md) — RabbitMQ first, Kafka later
- [ADR-0003](0003-typeorm-over-prisma.md) — TypeORM over Prisma
- [ADR-0004](0004-golevelup-rabbitmq-over-nest-transport.md) — @golevelup/nestjs-rabbitmq over Nest's built-in RMQ transport
- [ADR-0005](0005-observability-stack.md) — Observability stack: pino, ALS request context, prom-client
- [ADR-0006](0006-llm-triage.md) — LLM triage as an event consumer inside the Work Orders service
- [ADR-0007](0007-outbox-pattern.md) — Transactional outbox with a polling relay
- [ADR-0008](0008-authentication.md) — Authentication at the edge, identity in the events
- [ADR-0009](0009-service-discovery.md) — Platform-native service discovery over a dedicated registry
