import { building } from '$app/environment';
import { Pool } from 'pg';
import { loadRuntimeConfig } from './config';
import { attachNeutralPoolErrorHandler } from './database-pool';

export const runtimeConfig = building ? null : loadRuntimeConfig(process.env);

export const pool = runtimeConfig
  ? new Pool({
      connectionString: runtimeConfig.databaseUrl,
      max: runtimeConfig.role === 'web' ? 4 : 2,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000,
      application_name: `familyboard-spike-${runtimeConfig.role}`
    })
  : null;

if (pool) {
  attachNeutralPoolErrorHandler(pool, () => {
    console.error(JSON.stringify({ event: 'database_pool_error', status: 'unavailable' }));
  });
}

export async function probeDatabase(): Promise<void> {
  if (!pool) throw new Error('Database unavailable during build analysis');
  await pool.query('select 1');
}
