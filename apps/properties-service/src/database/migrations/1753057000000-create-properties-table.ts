import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePropertiesTable1753057000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE properties (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        address_line1 varchar(200) NOT NULL,
        city varchar(100) NOT NULL,
        postcode varchar(20) NOT NULL,
        manager_email varchar(254) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_properties_city ON properties (city)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE properties`);
  }
}
