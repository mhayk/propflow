# API reference

The public API is served by the gateway under `/api`. **Interactive OpenAPI docs live at [`/api/docs`](http://localhost:3000/api/docs)** when the gateway is running — generated from the controllers, so they can't drift; this page is the GitHub-readable summary. How each flow works internally: [sequence diagrams](flows.md). The asynchronous side of the contract — domain events, brokers, delivery guarantees — lives in the [event catalog](events.md).

## Authentication

Every business route requires `Authorization: Bearer <token>` ([ADR-0008](adr/0008-authentication.md)). Get a token:

```bash
curl -s -X POST localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"manager@propflow.dev","password":"propflow"}'
# -> { "accessToken": "...", "role": "manager" }
```

Demo users (override via `AUTH_USERS`): `manager@propflow.dev`, `tenant@propflow.dev`, `tech@propflow.dev` — password `propflow`.

**401** = missing/invalid token. **403** = valid token, role not allowed. Roles: `tenant`, `manager`, `technician` (the [actors](flows.md)).

## Public endpoints (gateway, `:3000`)

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | public | Exchange credentials for a 1h JWT |
| GET | `/api/health` · `/api/health/ready` | public | Liveness / readiness probes |
| GET | `/api/metrics` | public | Prometheus metrics |
| GET | `/api/docs` | public | This API, interactive (Swagger UI) |
| POST | `/api/work-orders` | tenant, manager | Open a maintenance request (triage fields fill in asynchronously) |
| GET | `/api/work-orders` | any authenticated | List, with `page`, `limit`, `status`, `priority`, `propertyId` filters |
| GET | `/api/work-orders/:id` | any authenticated | One work order, including AI triage columns |
| PATCH | `/api/work-orders/:id/assign` | manager | Assign a technician (`{ assigneeId }`) — the only way into `assigned` |
| PATCH | `/api/work-orders/:id/status` | technician, manager | `{ status: in_progress \| completed \| cancelled }`; invalid transitions → 409 |
| POST | `/api/properties` | manager | Register a property |
| GET | `/api/properties` | any authenticated | List properties (`page`, `limit`) |
| GET | `/api/properties/:id` | any authenticated | One property |
| GET | `/api/properties/:id/summary` | any authenticated | Property + its work orders, composed; degrades gracefully (`workOrdersAvailable: false`) |
| GET | `/api/activity` | manager | Audit feed, keyset-paginated (`limit`, `cursor`, `workOrderId`) — each entry carries `actorId` |

Downstream errors pass through untouched (validation 400s, domain 409s); transport failures translate to 502/504.

## Worked example

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"manager@propflow.dev","password":"propflow"}' | jq -r .accessToken)

# open a request
curl -s -X POST localhost:3000/api/work-orders \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Burst pipe","description":"Water everywhere","propertyId":"<uuid>","priority":"urgent"}'

# watch the audit trail (who did what, incl. the AI triage event)
curl -s "localhost:3000/api/activity?limit=10" -H "Authorization: Bearer $TOKEN"
```

## Internal service APIs

Not reachable from outside the cluster (NetworkPolicy allows ingress from the gateway only); listed for orientation — the gateway proxies to them 1:1.

| Service | Port | Endpoints | Notes |
| --- | --- | --- | --- |
| work-orders | 3001 | `/work-orders*` | Owns validation and the state machine; consumes `work-order.created` for AI triage |
| properties | 3003 | `/properties*` | Owns property data |
| audit | 3004 | `/activity` | Keyset-paginated projection of the Kafka stream |
| notifications | 3002 | *(none public)* | Pure event consumer |
| all | — | `/health`, `/health/ready`, `/metrics` | Probes + Prometheus, per service |
