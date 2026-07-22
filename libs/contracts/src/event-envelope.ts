/**
 * Every domain event travels inside this envelope. `eventId` enables
 * idempotent consumers (at-least-once delivery means duplicates WILL happen);
 * `occurredAt` is the domain time, not the delivery time.
 */
export interface EventEnvelope<TType extends string, TData> {
  eventId: string;
  type: TType;
  occurredAt: string;
  /** Request id of the HTTP call that caused this event, when there was one —
   * lets one user action be traced across services AND the async boundary. */
  correlationId: string | null;
  /** Authenticated user behind the action (JWT subject), when there was one.
   * Optional: events emitted by the system itself (e.g. AI triage) have no
   * human actor, and events predate authentication (phase 8). */
  actorId?: string | null;
  data: TData;
}
