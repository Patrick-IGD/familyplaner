import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

// Versionierte SQL-Migrationen, transaktional mit Advisory-Lock und Marker.
// Später kann drizzle-kit die SQL-Dateien erzeugen; der Ablauf bleibt gleich.

const migrationFiles = ["0001_initial.sql"];

async function isApplied(
  client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>;
  },
  id: string,
): Promise<boolean> {
  const result = await client.query(
    "select 1 from familyplanner_migration where migration_id = $1",
    [id],
  );
  return result.rowCount !== 0;
}

export async function applyMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [
      "familyplanner-migration",
    ]);
    await client.query(`
      create table if not exists familyplanner_migration (
        migration_id text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    for (const file of migrationFiles) {
      const migrationId = file.replace(/\.sql$/, "");
      if (await isApplied(client, migrationId)) continue;
      const sql = await readFile(
        join(process.cwd(), "migrations", file),
        "utf8",
      );
      await client.query(sql);
      await client.query(
        "insert into familyplanner_migration (migration_id) values ($1)",
        [migrationId],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
