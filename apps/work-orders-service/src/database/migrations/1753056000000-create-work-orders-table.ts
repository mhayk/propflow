import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkOrdersTable1753056000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE work_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(200) NOT NULL,
        description text NOT NULL,
        property_id uuid NOT NULL,
        priority varchar(10) NOT NULL DEFAULT 'medium',
        status varchar(20) NOT NULL DEFAULT 'open',
        assignee_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_work_orders_priority
          CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        CONSTRAINT chk_work_orders_status
          CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
        CONSTRAINT chk_work_orders_assignee_when_assigned
          CHECK (status <> 'assigned' OR assignee_id IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_work_orders_property_id ON work_orders (property_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_work_orders_status ON work_orders (status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE work_orders`);
  }
}
