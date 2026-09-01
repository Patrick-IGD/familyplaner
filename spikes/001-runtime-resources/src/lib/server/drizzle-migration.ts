import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

/**
 * REQ-011 / AC-010: Drizzle-Testmigration.
 *
 * Die Tabelle wird als echtes Drizzle-PG-Core-Schema definiert und über
 * Drizzle gegen PostgreSQL migriert. Die Migration ist idempotent:
 * eine zweite Ausführung auf einer bereits migrierten Datenbank erzeugt
 * weder Drift noch doppelte Objekte (create table if not exists plus
 * Marker in familyboard_migration).
 */

const drizzleMigrationId = '0003-drizzle-test';

export const drizzleProbe = pgTable('drizzle_probe', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessKey: text('business_key').notNull().unique(),
  attemptCount: integer('attempt_count').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

type Executor = { execute(query: ReturnType<typeof sql>): Promise<unknown> };

async function isApplied(client: Executor): Promise<boolean> {
  const result = (await client.execute(
    sql`select 1 from familyboard_migration where migration_id = ${drizzleMigrationId}`
  )) as { rows: unknown[] };
  return result.rows.length > 0;
}

export async function applyDrizzleTestMigration(pool: Pool): Promise<void> {
  const db = drizzle(pool);
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${'familyboard-drizzle-migration'}))`
    );
    await tx.execute(sql`
      create table if not exists familyboard_migration (
        migration_id text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    await tx.execute(sql`
      create table if not exists drizzle_probe (
        id uuid primary key default gen_random_uuid(),
        business_key text not null unique,
        attempt_count integer not null default 1,
        created_at timestamptz not null default now()
      )
    `);
    if (!(await isApplied(tx))) {
      await tx.execute(sql`
        insert into familyboard_migration (migration_id)
        values (${drizzleMigrationId})
        on conflict (migration_id) do nothing
      `);
    }
  });
}
