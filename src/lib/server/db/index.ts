import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema> & { $client: Pool };

let globalPool: Pool | undefined;

export function getPool(): Pool {
  if (!globalPool) {
    const databaseUrl = process.env.FAMILYPLANNER_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "Invalid runtime configuration: FAMILYPLANNER_DATABASE_URL",
      );
    }
    globalPool = new Pool({ connectionString: databaseUrl, max: 10 });
  }
  return globalPool;
}

/** Nur für Integrationstests: injiziert einen Kontext-Pool. */
export function setPoolForTesting(pool: Pool): void {
  globalPool = pool;
}

export function getDb(): Database {
  return drizzle(getPool(), { schema });
}

export async function closePool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = undefined;
  }
}
