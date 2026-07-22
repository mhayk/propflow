# ADR-0008: Authentication at the edge, identity in the events

- **Status**: Accepted
- **Date**: 2026-07-22

## Context

Through phase 7 every endpoint was open: the actors in the documentation (tenant, manager, technician) existed only conceptually. Phase 8 adds authentication and authorization — and, as importantly, decides *where* they live in a microservice system and how identity crosses both the sync (HTTP) and async (event) boundaries.

## Decisions

### Authenticate once, at the gateway — not in every service

The gateway is the single public entry point, so it is the single place tokens are verified. Services never see a JWT; they receive the already-verified identity as an `x-user-id` header. The alternative (each service verifying tokens) buys defense-in-depth at the cost of coupling every service to the token format and secret — reasonable at bank scale, ceremony here.

**What makes the header trustworthy is the network boundary, not the header**: the k8s NetworkPolicy allows ingress to services only from gateway pods. Anyone who can forge `x-user-id` is already inside the perimeter. (In local dev there is no such boundary — a documented, accepted gap.)

### JWT via @nestjs/jwt, no Passport

Stateless bearer tokens fit a gateway that fans out to services: no session store, and the payload (subject + role) is exactly what authorization needs. `@nestjs/jwt` alone covers sign + verify; Passport's strategy abstraction earns its keep with multiple auth providers, which we don't have. The trade every JWT design accepts: **no revocation before expiry** — mitigated with a 1-hour lifetime and no refresh flow (re-login at this scale).

### Guards: authentication global, authorization opt-in

`JwtAuthGuard` runs on every route (`APP_GUARD`), with `@Public()` as the explicit escape hatch (health probes, login, metrics). `RolesGuard` runs second: no `@Roles()` means any authenticated user. Secure-by-default with visible exceptions beats remembering to protect each new route. The status codes carry the semantics: 401 "who are you?", 403 "you can't do this".

### Roles are claims, enforcement is route policy

Three roles (`tenant`, `manager`, `technician`) mirror the actors in `docs/flows.md`; the mapping (tenants open requests, managers assign and read the feed, technicians progress work) lives as `@Roles()` metadata on the gateway's pass-through controllers — visible next to the route it protects, not in a policy engine.

### Demo credential store behind the real seam

Users come from `AUTH_USERS` env (constant-time password comparison) — obviously not production identity. The seam is what matters: the system consumes only the signed JWT, so swapping the credential store for an IdP (Keycloak/Auth0/OIDC) changes `AuthService.login` and nothing else.

### Identity propagates like the correlation id — and into the envelope

`x-user-id` rides the same path `x-request-id` built in phase 4 (header → ALS context → anywhere), and the outbox stamps `actorId` into every event envelope. The audit log now answers "who did it": human actions carry the JWT subject, system actions (AI triage) carry `null` — an honest distinction, not a gap.

## Consequences

- Every business route requires a token; probes and metrics stay public for the platform.
- The audit trail is attributable end-to-end, across the async boundary.
- Known limits, accepted and documented: no refresh/revocation, demo user store, header trust depends on the network boundary existing, and `/metrics` is unauthenticated (scrape auth belongs to the platform layer).
