# ADR-0009: Platform-native service discovery over a dedicated registry

- **Status**: Accepted
- **Date**: 2026-07-22

## Context

With five services calling each other (gateway → work-orders/properties/audit) and three pieces of stateful infrastructure, *something* has to answer "where is service X, and is it healthy?". The classic microservice answer is a dedicated service registry — Consul, Eureka, etcd — with self-registration, heartbeats and client-side discovery. This ADR records why PropFlow deliberately has none, and what plays the role instead.

## Decisions

### Discovery is layered, and each layer uses the cheapest mechanism that works

1. **Local development: static environment configuration.** The gateway's clients resolve base URLs at construction (`WORK_ORDERS_URL ?? localhost:3001`, …). The service set is fixed and known at build time; a lookup indirection would add a moving part and remove greppability.
2. **Kubernetes: the platform is the registry.** The ConfigMap points at Service DNS names (`http://work-orders:3001`); CoreDNS resolves them, ClusterIP load-balances across pods, and the **readiness probe (phase 4) is the health-gating half of a registry** — a pod that fails `/health/ready` leaves the Service's endpoints and stops receiving traffic. Registration, resolution and eviction all exist; they are provided by the orchestrator, not reimplemented in the application.
3. **The async paths need no discovery at all.** Notifications, triage and audit never locate another service — the broker is the rendezvous point (exchange/topic on one side, queue/consumer group on the other). Event-driven decoupling makes half of the system's communication discovery-free by construction.

### Rejected: an application-level registry (Consul/Eureka)

Self-registration + heartbeat + client-side discovery earns its complexity when instances appear outside any orchestrator (VMs, bare metal), span multiple clusters/runtimes, or when routing needs registry metadata (versions, zones, weights). None of that is true here — every runtime instance lives in one cluster that already tracks membership. Running Consul next to Kubernetes would duplicate the platform's endpoints controller and add an infrastructure component whose failure modes we would own.

### The evolution path is a service mesh, not a registry

If discovery requirements outgrow DNS — per-request load balancing, retries/circuit-breaking outside application code, mTLS between services, traffic splitting — the next step is a mesh (Istio/Linkerd), which subsumes the registry role in its control plane. Today those concerns have lightweight in-repo stand-ins: timeout + fail-fast in the `DownstreamClient` (ADR at phase 3), graceful degradation in the summary composition, and NetworkPolicies approximating the trust boundary mTLS would formalize (ADR-0008).

## Consequences

- Zero discovery infrastructure to operate; "where is X" is answered by grep in dev and by `kubectl get svc` in production.
- Swapping a downstream's location is configuration (env/ConfigMap), not code.
- Honest limitations, accepted:
  - **ClusterIP + keep-alive skews load balancing** — Node's agent reuses connections, so per-request distribution across pods is imperfect; a mesh's client-side balancing would fix it.
  - **No circuit breaker** — the gateway fails fast per request (3s timeout) but never opens a circuit; a persistently slow downstream is re-attempted on every request.
  - **DNS caching can lag pod churn** — mitigated by readiness gating, not eliminated.
  - **Local dev trusts static defaults** — nothing verifies the env points where you think it does; the full-stack e2e suite is what catches miswiring.
