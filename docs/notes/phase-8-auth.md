# Phase 8 — Authentication & authorization: identity across boundaries

## Authentication ≠ authorization, and the status codes say so

Two different questions, two different guards, two different failures: **401** answers "who are you?" (missing/invalid token — `JwtAuthGuard`), **403** answers "I know who you are; you can't do this" (role outside the route policy — `RolesGuard`). Keeping them separate isn't pedantry: clients react differently (401 → re-login, 403 → hide the button), and conflating them leaks information.

## Where auth lives in a microservice system

The interesting decision isn't "JWT or session" — it's *placement*. Options:

1. **Every service verifies tokens**: defense in depth, but every service now depends on the secret and token format; rotation touches the fleet.
2. **Gateway verifies, services trust (chosen)**: one verification point, services receive plain identity (`x-user-id`). The trust is only sound because of the **network boundary** — the k8s NetworkPolicy is what makes the header unforgeable, which means the security property lives partly in infrastructure, not code. Read `networkpolicy.yaml` as part of the auth implementation.

A useful habit: for any "service trusts X" claim, ask *what enforces it* — here the answer is the CNI, and in local dev (no policy) the honest answer is "nothing".

## JWT: what the statelessness actually buys and costs

A signed token makes every request self-authenticating — no session store, no lookup, horizontal scale for free. The cost is symmetric: **nothing to delete means nothing to revoke**. A stolen token works until expiry. Mitigations form a ladder (short expiry → refresh-token rotation → denylist → back to stateful sessions); this system stops at the first rung (1h, re-login), and knowing where you stopped is the point.

## Secure by default, public by exception

The global `APP_GUARD` + `@Public()` decorator inverts the failure mode: forget to annotate a new route and it's *closed*, not open. The exceptions document themselves — login (bootstrap), health (the platform has no token), metrics (Prometheus doesn't authenticate; if it must, that's the platform's mTLS/scrape-auth job, not the app's).

## Small crypto hygiene, big lesson

The demo login compares passwords with `timingSafeEqual`: `===` short-circuits on the first differing byte, and response-time differences leak match prefixes. The demo store is throwaway; the habit isn't. Same family of care: the login error is identical for "unknown email" and "wrong password" — user enumeration is a vulnerability, not a UX nicety.

## Identity across the async boundary

Propagating identity in a distributed system has two halves, and phase 4 already built the rails for the first:

- **Sync**: JWT verified → `setCurrentUserId()` into ALS → `DownstreamClient` adds `x-user-id` → services' middleware reopens the context. Identical mechanics to `x-request-id`.
- **Async**: the outbox stamps `actorId` into the event envelope, so the audit projection can answer *who* — the phase 5 feed gains its missing column. System-initiated events (AI triage) carry `actorId: null`, which is information ("no human did this"), not absence.

The subtle detail: the ALS store is *mutated* by the guard (`setCurrentUserId`), not reopened — middleware runs before guards, so the context exists before the user is known. Understanding that ordering (middleware → guards → interceptors → handler) is half of understanding Nest.

## Honest limitations (worth volunteering in review)

- **No refresh flow, no revocation** — a leaked token lives up to 1h; ADR-0008 documents the ladder not climbed.
- **Demo users in env config** — the seam (`AuthService.login` behind the JWT) is real; the store is not. An IdP swap touches one method.
- **Local dev trusts `x-user-id` blindly** — the NetworkPolicy only exists in k8s.
- **No per-user rate limiting or lockout** — credential stuffing is unimpeded.
- **Role model is coarse** — three static roles, no resource-level ownership (a tenant can read any work order, not just their own). Row-level authorization would need tenancy data the domain doesn't model yet.
