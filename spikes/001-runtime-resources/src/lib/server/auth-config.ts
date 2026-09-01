export type AuthConfig = {
  secret: string;
  origin: string;
  rpId: string;
  allowEmailPasswordSignUp: boolean;
};

export function loadAuthConfig(input: Record<string, string | undefined>): AuthConfig {
  if (!input.FAMILYBOARD_AUTH_SECRET || input.FAMILYBOARD_AUTH_SECRET.length < 32) {
    throw new Error('Invalid auth configuration: FAMILYBOARD_AUTH_SECRET');
  }

  const origin = input.FAMILYBOARD_APP_ORIGIN!;
  const originUrl = new URL(origin);
  const rawTestMode = input.FAMILYBOARD_AUTH_TEST_MODE;
  if (rawTestMode !== undefined && rawTestMode !== 'true' && rawTestMode !== 'false') {
    throw new Error('Invalid auth configuration: FAMILYBOARD_AUTH_TEST_MODE');
  }
  const testMode = rawTestMode === 'true';
  if (testMode && originUrl.hostname !== 'localhost') {
    throw new Error('Invalid auth configuration: FAMILYBOARD_AUTH_TEST_MODE');
  }

  return {
    secret: input.FAMILYBOARD_AUTH_SECRET,
    origin,
    rpId: originUrl.hostname,
    allowEmailPasswordSignUp: testMode
  };
}
