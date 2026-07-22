import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActorId1753316000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable: events from before authentication, and system-initiated
    // events (AI triage), have no human actor.
    await queryRunner.query(
      `ALTER TABLE audit_events ADD COLUMN actor_id varchar(320)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_events DROP COLUMN actor_id`);
  }
}
