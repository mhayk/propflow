import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ name: 'address_line1', length: 200 })
  addressLine1!: string;

  @Index()
  @Column({ length: 100 })
  city!: string;

  @Column({ length: 20 })
  postcode!: string;

  // Notification recipient for events concerning this property.
  @Column({ name: 'manager_email', length: 254 })
  managerEmail!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
