import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations } from './migration';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const pool = new Pool({ connectionString: databaseUrl, max: 3 });

describe('applyMigrations', () => {
  beforeEach(async () => {
    await pool.query(
      'drop table if exists passkey, account, session, verification, "user", probe_effect, familyboard_migration cascade'
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('repairs missing real schema when both migration markers are present', async () => {
    await pool.query(`
      create table familyboard_migration (
        migration_id text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    await pool.query(
      "insert into familyboard_migration (migration_id) values ('0001-probe-effect'), ('0002-better-auth-passkey')"
    );

    await applyMigrations(pool);

    const tables = await pool.query(`
      select to_regclass('public.probe_effect') as probe_effect,
             to_regclass('public."user"') as "user",
             to_regclass('public.session') as session,
             to_regclass('public.account') as account,
             to_regclass('public.verification') as verification,
             to_regclass('public.passkey') as passkey
    `);
    const passkeyColumns = await pool.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'passkey'
      order by column_name
    `);

    expect(tables.rows).toEqual([
      {
        probe_effect: 'probe_effect',
        user: '"user"',
        session: 'session',
        account: 'account',
        verification: 'verification',
        passkey: 'passkey'
      }
    ]);
    expect(passkeyColumns.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(['id', 'publicKey', 'userId', 'credentialID'])
    );
  });

  it('is concurrency-safe and records the schema marker once', async () => {
    await Promise.all([applyMigrations(pool), applyMigrations(pool)]);

    const markers = await pool.query(
      'select migration_id from familyboard_migration order by migration_id'
    );
    const table = await pool.query("select to_regclass('public.probe_effect') as name");

    const passkeyTable = await pool.query("select to_regclass('public.passkey') as name");

    expect(markers.rows).toEqual([
      { migration_id: '0001-probe-effect' },
      { migration_id: '0002-better-auth-passkey' }
    ]);
    expect(table.rows).toEqual([{ name: 'probe_effect' }]);
    expect(passkeyTable.rows).toEqual([{ name: 'passkey' }]);
  });
});
