import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxTable1753228000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id bigserial PRIMARY KEY,
        event_id uuid NOT NULL,
        type varchar(50) NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        CONSTRAINT uq_outbox_events_event_id UNIQUE (event_id)
      )
    `);
    // Partial index: the relay only ever scans the unpublished tail, which
    // stays tiny no matter how large the published history grows.
    await queryRunner.query(
      `CREATE INDEX idx_outbox_events_unpublished ON outbox_events (id) WHERE published_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE outbox_events`);
  }
}
