import { describe, expect, it } from 'vitest';
import { loadAuthConfig } from './auth-config';

describe('loadAuthConfig', () => {
  it('derives the relying-party contract from the stable origin', () => {
    const config = loadAuthConfig({
      FAMILYBOARD_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
      FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net'
    });

    expect(config).toEqual({
      secret: '0123456789abcdef0123456789abcdef',
      origin: 'https://familyboard.example.ts.net',
      rpId: 'familyboard.example.ts.net',
      allowEmailPasswordSignUp: false
    });
  });

  it('keeps email/password sign-up disabled on localhost unless test mode is explicit', () => {
    const config = loadAuthConfig({
      FAMILYBOARD_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
      FAMILYBOARD_APP_ORIGIN: 'http://localhost:3300'
    });

    expect(config.allowEmailPasswordSignUp).toBe(false);
  });

  it('allows the localhost spike to opt into email/password sign-up explicitly', () => {
    const config = loadAuthConfig({
      FAMILYBOARD_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
      FAMILYBOARD_APP_ORIGIN: 'http://localhost:3300',
      FAMILYBOARD_AUTH_TEST_MODE: 'true'
    });

    expect(config.allowEmailPasswordSignUp).toBe(true);
  });

  it('fails closed when test mode is requested for a non-local origin', () => {
    expect(() =>
      loadAuthConfig({
        FAMILYBOARD_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
        FAMILYBOARD_APP_ORIGIN: 'https://familyboard.example.ts.net',
        FAMILYBOARD_AUTH_TEST_MODE: 'true'
      })
    ).toThrowError('Invalid auth configuration: FAMILYBOARD_AUTH_TEST_MODE');
  });

  it('rejects a known but invalid test-mode value', () => {
    expect(() =>
      loadAuthConfig({
        FAMILYBOARD_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
        FAMILYBOARD_APP_ORIGIN: 'http://localhost:3300',
        FAMILYBOARD_AUTH_TEST_MODE: '1'
      })
    ).toThrowError('Invalid auth configuration: FAMILYBOARD_AUTH_TEST_MODE');
  });

  it('rejects a missing or short auth secret without echoing values', () => {
    expect(() =>
      loadAuthConfig({
        FAMILYBOARD_AUTH_SECRET: 'too-short',
        FAMILYBOARD_APP_ORIGIN: 'http://localhost:3300'
      })
    ).toThrowError('Invalid auth configuration: FAMILYBOARD_AUTH_SECRET');
  });
});
