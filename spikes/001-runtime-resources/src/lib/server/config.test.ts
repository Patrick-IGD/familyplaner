import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from './config';

describe('loadRuntimeConfig', () => {
  it('loads the complete runtime contract', () => {
    const config = loadRuntimeConfig({
      FAMILYBOARD_DATABASE_URL: 'postgresql://familyboard:test-only@db:5432/familyboard',
      FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net',
      FAMILYBOARD_ROLE: 'worker',
      FAMILYBOARD_LOG_LEVEL: 'warn'
    });

    expect(config).toEqual({
      databaseUrl: 'postgresql://familyboard:test-only@db:5432/familyboard',
      appOrigin: 'https://familyboard.example.ts.net',
      role: 'worker',
      logLevel: 'warn'
    });
  });

  it('rejects a missing database URL without echoing other values', () => {
    const marker = 'must-not-appear';
    const invalidInput = {
      FAMILYBOARD_APP_ORIGIN: `https://${marker}.example.ts.net`,
      FAMILYBOARD_ROLE: 'web',
      FAMILYBOARD_LOG_LEVEL: 'info'
    };

    expect(() => loadRuntimeConfig(invalidInput)).toThrowError(
      'Invalid runtime configuration: FAMILYBOARD_DATABASE_URL'
    );

    try {
      loadRuntimeConfig(invalidInput);
    } catch (error) {
      expect(String(error)).not.toContain(marker);
    }
  });

  it('rejects an enabled auth test mode at a remote origin for every role', () => {
    expect(() =>
      loadRuntimeConfig({
        FAMILYBOARD_DATABASE_URL: 'postgresql://familyboard:***@db:5432/familyboard',
        FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net',
        FAMILYBOARD_ROLE: 'worker',
        FAMILYBOARD_LOG_LEVEL: 'info',
        FAMILYBOARD_AUTH_TEST_MODE: 'true'
      })
    ).toThrowError('Invalid runtime configuration: FAMILYBOARD_AUTH_TEST_MODE');
  });

  it('rejects an unknown auth test mode value before either role starts', () => {
    expect(() =>
      loadRuntimeConfig({
        FAMILYBOARD_DATABASE_URL: 'postgresql://familyboard:***@db:5432/familyboard',
        FAMILYBOARD_APP_ORIGIN: 'http://localhost:3300',
        FAMILYBOARD_ROLE: 'worker',
        FAMILYBOARD_LOG_LEVEL: 'info',
        FAMILYBOARD_AUTH_TEST_MODE: '1'
      })
    ).toThrowError('Invalid runtime configuration: FAMILYBOARD_AUTH_TEST_MODE');
  });

  it('rejects unknown familyboard fields', () => {
    expect(() =>
      loadRuntimeConfig({
        FAMILYBOARD_DATABASE_URL: 'postgresql://familyboard:test-only@db:5432/familyboard',
        FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net',
        FAMILYBOARD_ROLE: 'web',
        FAMILYBOARD_LOG_LEVEL: 'info',
        FAMILYBOARD_UNDECLARED_SECRET: 'must-not-appear'
      })
    ).toThrowError('Invalid runtime configuration: unknown field FAMILYBOARD_UNDECLARED_SECRET');
  });

  it('rejects a role outside the allowlist', () => {
    expect(() =>
      loadRuntimeConfig({
        FAMILYBOARD_DATABASE_URL: 'postgresql://familyboard:test-only@db:5432/familyboard',
        FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net',
        FAMILYBOARD_ROLE: 'admin',
        FAMILYBOARD_LOG_LEVEL: 'info'
      })
    ).toThrowError('Invalid runtime configuration: FAMILYBOARD_ROLE');
  });

  it('rejects a non-HTTPS non-localhost origin', () => {
    expect(() =>
      loadRuntimeConfig({
        FAMILYBOARD_DATABASE_URL: 'postgresql://familyboard:test-only@db:5432/familyboard',
        FAMILYBOARD_APP_ORIGIN: 'http://familyboard.lan',
        FAMILYBOARD_ROLE: 'web',
        FAMILYBOARD_LOG_LEVEL: 'info'
      })
    ).toThrowError('Invalid runtime configuration: FAMILYBOARD_APP_ORIGIN');
  });

  it('rejects a log level outside the allowlist', () => {
    expect(() =>
      loadRuntimeConfig({
        FAMILYBOARD_DATABASE_URL: 'postgresql://familyboard:test-only@db:5432/familyboard',
        FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net',
        FAMILYBOARD_ROLE: 'web',
        FAMILYBOARD_LOG_LEVEL: 'verbose'
      })
    ).toThrowError('Invalid runtime configuration: FAMILYBOARD_LOG_LEVEL');
  });

  it('rejects a database URL with a non-PostgreSQL scheme', () => {
    expect(() =>
      loadRuntimeConfig({
        FAMILYBOARD_DATABASE_URL: 'https://db.example.invalid/familyboard',
        FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net',
        FAMILYBOARD_ROLE: 'web',
        FAMILYBOARD_LOG_LEVEL: 'info'
      })
    ).toThrowError('Invalid runtime configuration: FAMILYBOARD_DATABASE_URL');
  });
});
