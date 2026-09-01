import { Pool } from 'pg';
import { loadRuntimeConfig } from './lib/server/config.js';
import { applyMigrations } from './lib/server/migration.js';

async function main(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1 });
  try {
    await applyMigrations(pool);
    console.log(JSON.stringify({ event: 'migration_complete', status: 'ok' }));
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error(JSON.stringify({ event: 'migration_failed', status: 'failed' }));
  process.exitCode = 1;
});
