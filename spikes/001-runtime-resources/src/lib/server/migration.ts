import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';

const probeMigrationId = '0001-probe-effect';
const authMigrationId = '0002-better-auth-passkey';

const probeMigrationSql = `
  create table if not exists probe_effect (
    business_key text primary key check (char_length(business_key) between 1 and 128),
    effect_count smallint not null default 1 check (effect_count = 1),
    attempt_count integer not null default 1 check (attempt_count > 0),
    completed_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )
`;

function idempotentSchemaSql(sql: string): string {
  return sql
    .replaceAll('create table ', 'create table if not exists ')
    .replaceAll('create index ', 'create index if not exists ');
}

async function isApplied(client: PoolClient, migrationId: string): Promise<boolean> {
  const marker = await client.query(
    'select migration_id from familyboard_migration where migration_id = $1',
    [migrationId]
  );
  return marker.rowCount !== 0;
}

async function recordMigration(client: PoolClient, migrationId: string): Promise<void> {
  await client.query('insert into familyboard_migration (migration_id) values ($1)', [migrationId]);
}

export async function applyMigrations(pool: Pool): Promise<void> {
  const authMigrationSql = await readFile(
    join(process.cwd(), 'migrations', '0002_better_auth.sql'),
    'utf8'
  );
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [
      'familyboard-spike-migration'
    ]);
    await client.query(`
      create table if not exists familyboard_migration (
        migration_id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    await client.query(probeMigrationSql);
    if (!(await isApplied(client, probeMigrationId))) {
      await recordMigration(client, probeMigrationId);
    }

    await client.query(idempotentSchemaSql(authMigrationSql));
    if (!(await isApplied(client, authMigrationId))) {
      await recordMigration(client, authMigrationId);
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
