import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTriageColumns1753142000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE work_orders
        ADD COLUMN triage_category varchar(30),
        ADD COLUMN triage_urgency varchar(10),
        ADD COLUMN triage_reasoning text,
        ADD COLUMN triaged_at timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE work_orders
        DROP COLUMN triage_category,
        DROP COLUMN triage_urgency,
        DROP COLUMN triage_reasoning,
        DROP COLUMN triaged_at
    `);
  }
}
