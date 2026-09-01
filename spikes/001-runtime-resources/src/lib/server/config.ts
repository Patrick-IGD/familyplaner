import { z } from 'zod';

const runtimeKeys = new Set([
  'FAMILYBOARD_DATABASE_URL',
  'FAMILYBOARD_APP_ORIGIN',
  'FAMILYBOARD_ROLE',
  'FAMILYBOARD_LOG_LEVEL'
]);
const allowedKeys = new Set([
  ...runtimeKeys,
  'FAMILYBOARD_AUTH_SECRET',
  'FAMILYBOARD_AUTH_TEST_MODE'
]);

function isAllowedOrigin(value: string): boolean {
  try {
    const origin = new URL(value);
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    return (
      origin.origin === value &&
      (origin.protocol === 'https:' || (origin.protocol === 'http:' && isLocalhost))
    );
  } catch {
    return false;
  }
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      Boolean(url.hostname && url.pathname !== '/')
    );
  } catch {
    return false;
  }
}

const envSchema = z.strictObject({
  FAMILYBOARD_DATABASE_URL: z.string().refine(isPostgresUrl),
  FAMILYBOARD_APP_ORIGIN: z.string().refine(isAllowedOrigin),
  FAMILYBOARD_ROLE: z.enum(['web', 'worker']),
  FAMILYBOARD_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error'])
});

export type RuntimeConfig = {
  databaseUrl: string;
  appOrigin: string;
  role: 'web' | 'worker';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

export function loadRuntimeConfig(input: Record<string, string | undefined>): RuntimeConfig {
  const familyboardInput = Object.fromEntries(
    Object.entries(input).filter(([key]) => key.startsWith('FAMILYBOARD_'))
  );
  const unknownKey = Object.keys(familyboardInput).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    throw new Error(`Invalid runtime configuration: unknown field ${unknownKey}`);
  }

  const authTestMode = familyboardInput.FAMILYBOARD_AUTH_TEST_MODE;
  if (authTestMode !== undefined && authTestMode !== 'true' && authTestMode !== 'false') {
    throw new Error('Invalid runtime configuration: FAMILYBOARD_AUTH_TEST_MODE');
  }
  const runtimeInput = Object.fromEntries(
    Object.entries(familyboardInput).filter(([key]) => runtimeKeys.has(key))
  );
  const result = envSchema.safeParse(runtimeInput);
  if (!result.success) {
    const field = result.error.issues[0]?.path[0] ?? 'unknown field';
    throw new Error(`Invalid runtime configuration: ${String(field)}`);
  }
  if (
    authTestMode === 'true' &&
    new URL(result.data.FAMILYBOARD_APP_ORIGIN).hostname !== 'localhost'
  ) {
    throw new Error('Invalid runtime configuration: FAMILYBOARD_AUTH_TEST_MODE');
  }

  return {
    databaseUrl: result.data.FAMILYBOARD_DATABASE_URL,
    appOrigin: result.data.FAMILYBOARD_APP_ORIGIN,
    role: result.data.FAMILYBOARD_ROLE,
    logLevel: result.data.FAMILYBOARD_LOG_LEVEL
  };
}
