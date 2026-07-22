# Kubernetes manifests

Deployments + Services for the five PropFlow apps, wired to the phase 4 health probes (liveness `/health`, readiness `/health/ready`) and the phase 7 hardening (graceful shutdown on SIGTERM, non-root containers, resource requests/limits).

## What is assumed to exist

- **PostgreSQL, RabbitMQ and Kafka** reachable as the in-cluster Services `postgres`, `rabbitmq` and `kafka`. Stateful infrastructure is deliberately out of scope here — in a real cluster it comes from operators (CloudNativePG, RabbitMQ Cluster Operator, Strimzi) or managed services, not hand-rolled StatefulSets.
- **Images** built from the repo's parameterized `Dockerfile`:

  ```bash
  for app in api-gateway work-orders-service notifications-service properties-service audit-service; do
    docker build --build-arg APP=$app -t ghcr.io/mhayk/propflow-$app:latest .
  done
  ```

- **The secret** `propflow-secrets` created before applying (template + kubectl one-liner in `secret.example.yaml`).

## Apply

```bash
kubectl apply -k k8s/
```

## Design notes

- `work-orders` runs 2 replicas on purpose: the outbox relay claims rows with `FOR UPDATE SKIP LOCKED`, so concurrent relays never double-publish — the manifest is the proof the pattern scales horizontally.
- `notifications` is pinned to 1 replica because its dedup store is in-memory (per-instance); a shared store (Redis/DB) is the documented upgrade to scale it out.
- Migrations run on boot (`migrationsRun: true`) — fine for one writer per database at this scale; a real pipeline promotes them to a pre-deploy job.
