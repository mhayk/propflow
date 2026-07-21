# ADR-0004: @golevelup/nestjs-rabbitmq over Nest's built-in RMQ transport

- **Status**: Accepted
- **Date**: 2026-07-21

## Context

Services exchange domain events through RabbitMQ (ADR-0002). NestJS offers a built-in RMQ transport via `@nestjs/microservices`; the community standard alternative is `@golevelup/nestjs-rabbitmq`.

## Options considered

### 1. `@nestjs/microservices` RMQ transport

Designed as a broker-agnostic *transport* layer: the same `@MessagePattern`/`@EventPattern` code should run over Redis, NATS, Kafka or RabbitMQ.

- ✅ No extra dependency; official docs.
- ✅ Fine for simple request-response or single-queue worker setups.
- ❌ The abstraction hides exactly what we need to control: one queue per app (not per handler), no first-class exchange/binding declaration, topic routing must be emulated.
- ❌ Dead-letter and retry topologies require dropping to `socketOptions`/manual channel setup — the abstraction stops paying for itself precisely where messaging gets hard.
- ❌ A separate "hybrid application" bootstrap is needed alongside HTTP.

### 2. `@golevelup/nestjs-rabbitmq` (chosen)

Embraces AMQP instead of abstracting it: exchanges, bindings, per-handler queues and channel config are declared where they belong.

- ✅ `@RabbitSubscribe` binds a *named, durable* queue to a topic exchange per handler — the unit of scaling and retry we actually want.
- ✅ Queue/exchange topology (including our TTL-retry and DLQ queues) is declared in module config and asserted on boot.
- ✅ Runs inside the normal HTTP application; connection management (reconnect, channel recovery) handled by `amqp-connection-manager`.
- ❌ Third-party dependency (well-maintained, widely used).
- ❌ Couples consumer code to RabbitMQ — acceptable: ADR-0002 already picked the broker per use case, and the Kafka feed will use Kafka-native tooling for the same reason.

## Decision

`@golevelup/nestjs-rabbitmq` for both publishing and consuming.

## Consequences

- Broker topology is code-reviewed: exchange names and routing keys come from `libs/contracts`, queue declarations from each consumer's module.
- "Portability" across brokers is consciously given up in the messaging layer; portability lives one level up, in handlers that receive typed envelopes and know nothing about AMQP.
