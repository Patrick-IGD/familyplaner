import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import type { AuthConfig } from './auth-config';

export function createFamilyboardAuth(pool: Pool, config: AuthConfig) {
  return betterAuth({
    appName: 'Familyboard Passkey Spike',
    baseURL: config.origin,
    database: {
      dialect: new PostgresDialect({ pool }),
      type: 'postgres'
    },
    emailAndPassword: {
      enabled: config.allowEmailPasswordSignUp,
      disableSignUp: !config.allowEmailPasswordSignUp
    },
    secret: config.secret,
    trustedOrigins: [config.origin],
    plugins: [
      passkey({
        origin: config.origin,
        rpID: config.rpId,
        rpName: 'Familyboard'
      })
    ]
  });
}
