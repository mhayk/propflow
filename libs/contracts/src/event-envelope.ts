/**
 * Every domain event travels inside this envelope. `eventId` enables
 * idempotent consumers (at-least-once delivery means duplicates WILL happen);
 * `occurredAt` is the domain time, not the delivery time.
 */
export interface EventEnvelope<TType extends string, TData> {
  eventId: string;
  type: TType;
  occurredAt: string;
  data: TData;
}
