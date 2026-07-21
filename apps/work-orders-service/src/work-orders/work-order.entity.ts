import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkOrderPriority, WorkOrderStatus } from './work-order.enums';

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  // Reference to the Properties service's aggregate — an ID only, never a DB-level
  // foreign key: the properties table lives in another service's database.
  @Index()
  @Column({ name: 'property_id', type: 'uuid' })
  propertyId!: string;

  @Column({ type: 'varchar', length: 10, default: WorkOrderPriority.MEDIUM })
  priority!: WorkOrderPriority;

  @Index()
  @Column({ type: 'varchar', length: 20, default: WorkOrderStatus.OPEN })
  status!: WorkOrderStatus;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
