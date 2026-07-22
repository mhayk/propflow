import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Append-only projection of the Kafka stream. The bigserial id doubles as the
 * feed cursor: monotonic, gapless enough for keyset pagination, and cheap.
 * (Contrast with the services' UUID keys: an internal, single-writer,
 * append-only table is exactly where serial keys shine.)
 */
@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  // The consumer's idempotency key: at-least-once delivery means the same
  // event WILL arrive twice; the unique index makes the second insert a no-op.
  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'event_type', length: 50 })
  eventType!: string;

  @Index()
  @Column({ name: 'work_order_id', type: 'uuid' })
  workOrderId!: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId!: string;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  correlationId!: string | null;

  /** Who performed the action (JWT subject) — null for system-initiated
   * events (AI triage) and events from before authentication existed. */
  @Column({ name: 'actor_id', type: 'varchar', length: 320, nullable: true })
  actorId!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;
}
