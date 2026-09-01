// Führt die versionierten SQL-Migrationen aus (gleicher Mechanismus wie in der App).
import { Pool } from "pg";
import { applyMigrations } from "../src/lib/server/db/migrate.ts";

const databaseUrl = process.env.FAMILYPLANNER_DATABASE_URL;
if (!databaseUrl) {
  console.error(
    JSON.stringify({
      event: "migration_failed",
      reason: "missing FAMILYPLANNER_DATABASE_URL",
    }),
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  await applyMigrations(pool);
  console.log(JSON.stringify({ event: "migration_complete", status: "ok" }));
} catch (error) {
  console.error(
    JSON.stringify({ event: "migration_failed", status: "failed" }),
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
