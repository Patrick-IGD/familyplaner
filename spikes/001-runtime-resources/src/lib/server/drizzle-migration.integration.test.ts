import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { applyDrizzleTestMigration } from './drizzle-migration';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const pool = new Pool({ connectionString: databaseUrl, max: 3 });

async function tableExists(name: string): Promise<boolean> {
  const result = await pool.query('select to_regclass($1) as name', [`public.${name}`]);
  return result.rows[0]?.name !== null;
}

async function columnNames(table: string): Promise<string[]> {
  const result = await pool.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by column_name`,
    [table]
  );
  return result.rows.map((row) => row.column_name as string);
}

async function drizzleMarkerCount(): Promise<number> {
  const result = await pool.query(
    "select count(*)::int as count from familyboard_migration where migration_id = '0003-drizzle-test'"
  );
  return result.rows[0].count;
}

describe('applyDrizzleTestMigration', () => {
  beforeEach(async () => {
    await pool.query('drop table if exists drizzle_probe, familyboard_migration cascade');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates the expected schema on a fresh database', async () => {
    await applyDrizzleTestMigration(pool);

    expect(await tableExists('drizzle_probe')).toBe(true);
    expect(await columnNames('drizzle_probe')).toEqual([
      'attempt_count',
      'business_key',
      'created_at',
      'id'
    ]);
    expect(await drizzleMarkerCount()).toBe(1);
  });

  it('is idempotent: second run on an already migrated database produces no drift', async () => {
    await applyDrizzleTestMigration(pool);
    await applyDrizzleTestMigration(pool);

    expect(await tableExists('drizzle_probe')).toBe(true);
    expect(await drizzleMarkerCount()).toBe(1);

    const duplicateCheck = await pool.query(`
      select count(*)::int as count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'drizzle_probe'
    `);
    expect(duplicateCheck.rows[0].count).toBe(1);
  });

  it('repairs a missing table while the marker is already present', async () => {
    await applyDrizzleTestMigration(pool);
    await pool.query('drop table drizzle_probe');

    await applyDrizzleTestMigration(pool);

    expect(await tableExists('drizzle_probe')).toBe(true);
    expect(await drizzleMarkerCount()).toBe(1);
  });
});
