import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { WorkOrderEvent } from '@app/contracts';

/**
 * Staged domain events, written in the same transaction as the state change
 * they describe. The relay publishes and stamps published_at; a row with a
 * null published_at is the queue. This closes the dual-write gap: either the
 * work order AND its event commit, or neither does.
 */
@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ length: 50 })
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: WorkOrderEvent;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}
