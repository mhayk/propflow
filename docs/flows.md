# Sequence flows

How the pieces of PropFlow interact — per flow, with the actors that trigger them and the internal components of each service. These complement the [architecture diagram](../README.md#architecture) (static structure) and the [ADRs](adr) (why it's built this way): here the question is *what happens, in what order*.

**Actors**

| Actor | Interacts via | Typical actions |
| --- | --- | --- |
| Tenant | Client app → API Gateway | opens maintenance requests |
| Property manager | Client app → API Gateway | assigns/tracks work orders, reads summaries and the activity feed |
| Technician | Client app → API Gateway | moves work orders through the lifecycle |
| Anthropic API | called by the Work Orders service | classifies requests (category + urgency) |

All HTTP enters through the gateway under the `/api` prefix; no client talks to a service directly, and no service touches another service's database.

---

## 1. Creating a work order (the write path)

The defining property of the write path after phase 7: **it never talks to a broker**. The state change and its event commit in one Postgres transaction ([ADR-0007](adr/0007-outbox-pattern.md)); everything asynchronous happens later, off the request.

```mermaid
sequenceDiagram
    autonumber
    actor Tenant
    participant GW as API Gateway
    participant CT as WorkOrdersController
    participant SV as WorkOrdersService
    participant OB as WorkOrderEventsOutbox
    participant DB as Postgres (work_orders)

    Tenant->>GW: POST /api/work-orders
    Note over GW: mints x-request-id, forwards it downstream
    GW->>CT: POST /work-orders
    CT->>SV: create(dto) — after DTO validation
    rect rgb(232, 244, 233)
        Note over SV,DB: one transaction — state + event, atomically
        SV->>DB: INSERT work_orders
        SV->>OB: stage(manager, work-order.created)
        OB->>DB: INSERT outbox_events (envelope with correlationId)
    end
    SV-->>CT: work order (triagedAt: null)
    CT-->>GW: 201
    GW-->>Tenant: 201
    Note over Tenant: response returns before any broker is involved —<br/>brokers can be down and the write still succeeds
```

Assigning (`PATCH :id/assign`) and status transitions (`PATCH :id/status`) follow the same shape: state-machine guard → transaction → outbox row (`assigned`, `started`, `completed`, `cancelled`).

## 2. The outbox relay (staged rows → brokers)

Runs inside the Work Orders service on a poll interval. `FOR UPDATE SKIP LOCKED` lets multiple replicas relay concurrently without double-publishing.

```mermaid
sequenceDiagram
    autonumber
    participant RL as OutboxRelay
    participant DB as Postgres (outbox_events)
    participant MQ as RabbitMQ (propflow.events)
    participant KF as Kafka (propflow.work-orders)

    loop every OUTBOX_POLL_MS (default 500ms)
        RL->>DB: BEGIN + SELECT unpublished tail<br/>FOR UPDATE SKIP LOCKED
        alt batch published
            RL->>MQ: publish (routing key = event type, messageId = eventId)
            RL->>KF: produce (key = workOrderId → per-aggregate order)
            RL->>DB: stamp published_at, COMMIT
        else a broker fails
            RL->>DB: ROLLBACK — rows stay staged
            Note over RL: retried next tick — duplicates possible,<br/>every consumer dedupes (at-least-once)
        end
    end
```

## 3. Event fan-out (who reacts to `work-order.created`)

One event, three independent consumers — none knows the others exist. RabbitMQ fans out transient reactions; Kafka retains the replayable history ([ADR-0002](adr/0002-rabbitmq-first-kafka-later.md)).

```mermaid
sequenceDiagram
    participant MQ as RabbitMQ
    participant KF as Kafka
    participant NT as Notifications Service
    participant TR as Work Orders (triage consumer)
    participant AU as Audit Service

    par notification
        MQ->>NT: created (queue notifications.work-order-created)
        NT->>NT: seen this eventId? skip : send + mark
    and AI triage
        MQ->>TR: created (queue work-orders.triage)
        Note over TR: full loop in diagram 4
    and audit projection
        KF->>AU: same envelope, from the log
        AU->>AU: INSERT ... ON CONFLICT (event_id) DO NOTHING
    end
```

## 4. AI triage (async classification loop)

The Work Orders service reacting to *its own* event ([ADR-0006](adr/0006-llm-triage.md)) — the LLM sits behind the `TriageClassifier` seam and every failure degrades to "no classification".

```mermaid
sequenceDiagram
    autonumber
    participant MQ as RabbitMQ
    participant TC as WorkOrderTriageConsumer
    participant CL as AnthropicTriageClassifier
    participant AN as Anthropic API (claude-opus-4-8)
    participant TS as TriageService
    participant DB as Postgres (work_orders)

    MQ->>TC: work-order.created
    TC->>CL: classify(title, description, priority)
    alt no ANTHROPIC_API_KEY
        CL-->>TC: null — triage disabled
    else
        CL->>AN: messages.create (JSON schema with closed enums)
        alt classified
            AN-->>CL: category, urgency, reasoning
            CL-->>TC: WorkOrderTriage
            TC->>TS: apply(workOrderId, triage)
            TS->>DB: triagedAt already set? (duplicate delivery guard)
            rect rgb(232, 244, 233)
                Note over TS,DB: same atomic pair as the write path
                TS->>DB: UPDATE work_orders (triage columns)
                TS->>DB: INSERT outbox_events (work-order.triaged)
            end
            Note over DB: the relay fans the triaged event out —<br/>the AI decision lands in the audit log too
        else refusal or API failure
            AN-->>CL: refusal / error
            CL-->>TC: null — logged and skipped, order stays untriaged
        end
    end
```

## 5. Notification delivery, retries and the dead letter

What happens when the side effect fails — TTL-based retry, then dead-lettering with the error attached (phase 2 machinery).

```mermaid
sequenceDiagram
    autonumber
    participant MQ as RabbitMQ (work queue)
    participant CO as WorkOrderEventsConsumer
    participant ST as ProcessedEventsStore
    participant SN as NotificationSender
    participant RQ as retry queue (TTL)
    participant DL as dead-letter exchange

    MQ->>CO: work-order.completed
    CO->>ST: has(eventId)?
    alt already processed
        CO-->>MQ: ack (duplicate skipped)
    else first sight
        CO->>SN: send(recipient, subject, body)
        alt sent
            CO->>ST: mark(eventId) — only after success
        else send failed, attempts left
            CO->>RQ: republish with x-attempt + 1
            Note over RQ: TTL expires → message returns<br/>to the work queue for another try
        else attempts exhausted
            CO->>DL: dead-letter with x-last-error
            Note over DL: parked for a human — poison messages<br/>never block the queue
        end
    end
```

## 6. Property summary (composition with graceful degradation)

The gateway as composer: two downstream calls in parallel, and the secondary one is allowed to fail without failing the request (phase 3).

```mermaid
sequenceDiagram
    autonumber
    actor Manager as Property manager
    participant GW as API Gateway (PropertySummaryService)
    participant PR as Properties Service
    participant WO as Work Orders Service

    Manager->>GW: GET /api/properties/:id/summary
    par primary resource
        GW->>PR: GET /properties/:id
        PR-->>GW: property
    and secondary enrichment
        GW->>WO: GET /work-orders?propertyId=:id
        alt reachable
            WO-->>GW: work orders page
        else down / timeout
            WO--xGW: error (caught)
        end
    end
    alt property found
        GW-->>Manager: 200 — property + workOrders<br/>(or workOrders: null, workOrdersAvailable: false)
    else property missing / properties service down
        GW-->>Manager: error passed through — the primary resource is required
    end
```

## 7. Activity feed (audit read path — and how it fills)

Two halves that never meet synchronously: Kafka ingestion keeps the projection current; reads paginate it by keyset. Replay is the superpower — point a fresh consumer group at offset 0 and the table rebuilds.

```mermaid
sequenceDiagram
    autonumber
    participant KF as Kafka (propflow.work-orders)
    participant IC as AuditStreamConsumer
    participant DB as Postgres (audit_events)
    actor Manager as Property manager
    participant GW as API Gateway
    participant FE as ActivityFeedService

    Note over KF,DB: ingestion — continuous, idempotent
    KF->>IC: next event (consumer group offset)
    IC->>DB: INSERT ... ON CONFLICT (event_id) DO NOTHING

    Note over Manager,DB: reading — keyset pagination
    Manager->>GW: GET /api/activity?workOrderId=…&cursor=…
    GW->>FE: GET /activity (pass-through)
    FE->>DB: WHERE id < cursor ORDER BY id DESC LIMIT n+1
    FE-->>GW: data + nextCursor (null at the end)
    GW-->>Manager: page — stable even while new events append
```

## 8. Work order lifecycle (state machine)

Not a sequence but the state chart the transitions in diagrams 1 and 4 are guarded by (`work-order-transitions.ts`). `assigned` is only reachable through the assign endpoint — the one transition that guarantees an assignee exists — and cancellation is possible from any non-terminal state. Each transition emits the matching domain event through the outbox.

```mermaid
stateDiagram-v2
    [*] --> open: POST /work-orders<br/>(work-order.created)
    open --> assigned: assign<br/>(work-order.assigned)
    assigned --> assigned: reassign<br/>(work-order.assigned)
    assigned --> in_progress: status change<br/>(work-order.started)
    in_progress --> completed: status change<br/>(work-order.completed)
    open --> cancelled: (work-order.cancelled)
    assigned --> cancelled: (work-order.cancelled)
    in_progress --> cancelled: (work-order.cancelled)
    completed --> [*]
    cancelled --> [*]

    note right of open
        AI triage runs async after creation —
        it annotates (category/urgency),
        never drives a transition
    end note
```
