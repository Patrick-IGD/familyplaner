import { Pool } from 'pg';
import { loadAuthConfig } from './src/lib/server/auth-config';
import { createFamilyboardAuth } from './src/lib/server/familyboard-auth';

const databaseUrl = process.env.FAMILYBOARD_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Invalid auth CLI configuration: FAMILYBOARD_DATABASE_URL');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
export const auth = createFamilyboardAuth(pool, loadAuthConfig(process.env));
