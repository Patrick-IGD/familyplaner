import { building } from '$app/environment';
import { Pool } from 'pg';
import { loadAuthConfig } from './auth-config';
import { createFamilyboardAuth } from './familyboard-auth';
import { pool as runtimePool } from './runtime';

const buildOnlyPool = building
  ? new Pool({ connectionString: 'postgresql://build:build@127.0.0.1/build', max: 1 })
  : null;

const config = building
  ? loadAuthConfig({
      FAMILYBOARD_AUTH_SECRET: 'build-only-not-a-runtime-auth-secret',
      FAMILYBOARD_APP_ORIGIN: 'http://localhost:3300'
    })
  : loadAuthConfig(process.env);

const pool = runtimePool ?? buildOnlyPool;
if (!pool) {
  throw new Error('Authentication database pool is unavailable');
}

export const auth = createFamilyboardAuth(pool, config);
