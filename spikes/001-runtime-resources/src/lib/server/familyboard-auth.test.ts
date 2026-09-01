import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { createFamilyboardAuth } from './familyboard-auth';

const pool = {} as Pool;
const baseConfig = {
  secret: '0123456789abcdef0123456789abcdef',
  origin: 'https://familyboard.example.ts.net',
  rpId: 'familyboard.example.ts.net'
};

describe('createFamilyboardAuth', () => {
  it('uses Better Auth disableSignUp when generic self-registration is not allowed', () => {
    const auth = createFamilyboardAuth(pool, {
      ...baseConfig,
      allowEmailPasswordSignUp: false
    });

    expect(auth.options.emailAndPassword).toMatchObject({
      enabled: false,
      disableSignUp: true
    });
  });

  it('enables sign-up only for an explicitly permitted localhost test config', () => {
    const auth = createFamilyboardAuth(pool, {
      ...baseConfig,
      origin: 'http://localhost:3300',
      rpId: 'localhost',
      allowEmailPasswordSignUp: true
    });

    expect(auth.options.emailAndPassword).toMatchObject({
      enabled: true,
      disableSignUp: false
    });
  });
});
