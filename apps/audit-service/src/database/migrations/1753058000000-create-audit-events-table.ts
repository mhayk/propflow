import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditEventsTable1753058000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_events (
        id bigserial PRIMARY KEY,
        event_id uuid NOT NULL,
        event_type varchar(50) NOT NULL,
        work_order_id uuid NOT NULL,
        property_id uuid NOT NULL,
        correlation_id varchar(64),
        occurred_at timestamptz NOT NULL,
        payload jsonb NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_audit_events_event_id UNIQUE (event_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_audit_events_work_order ON audit_events (work_order_id, id DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE audit_events`);
  }
}
