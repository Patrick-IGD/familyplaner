import { chmod, mkdtemp, open, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runGoogleLiveRead, runGoogleLiveReadFromEnvironment } from './google-live-read.mjs';

const validCredentialJson = JSON.stringify({
  type: 'service_account',
  project_id: 'synthetic-project',
  client_email: 'calendar-reader@synthetic-project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----\n',
  token_uri: 'https://oauth2.googleapis.com/token'
});

test('rejects a missing credential file before network access', async () => {
  let networkCalls = 0;

  await assert.rejects(
    runGoogleLiveRead({
      calendarId: 'synthetic-test-calendar@example.invalid',
      allowedCalendarId: 'synthetic-test-calendar@example.invalid',
      credentialPath: '/definitely/missing/google-credential.json',
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('network must not be reached');
      }
    }),
    /Invalid Google credential configuration: GOOGLE_CREDENTIAL_FILE/
  );

  assert.equal(networkCalls, 0);
});

test('rejects a symlink credential without following it or calling the network', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const targetPath = join(directory, 'target.json');
  const credentialPath = join(directory, 'credential-link.json');
  let networkCalls = 0;

  try {
    await writeFile(targetPath, validCredentialJson, { mode: 0o600 });
    await symlink(targetPath, credentialPath);

    await assert.rejects(
      runGoogleLiveRead({
        calendarId: 'synthetic-test-calendar@example.invalid',
        allowedCalendarId: 'synthetic-test-calendar@example.invalid',
        credentialPath,
        signImpl: () => 'unused',
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }),
      /Invalid Google credential configuration: GOOGLE_CREDENTIAL_FILE/
    );
    assert.equal(networkCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects a symlinked credential parent before opening the credential', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const trustedDirectory = join(directory, 'trusted');
  const symlinkDirectory = join(directory, 'linked-parent');
  const credentialPath = join(symlinkDirectory, 'credential.json');
  let openCalls = 0;

  try {
    await (await import('node:fs/promises')).mkdir(trustedDirectory, { mode: 0o700 });
    await writeFile(join(trustedDirectory, 'credential.json'), validCredentialJson, { mode: 0o600 });
    await symlink(trustedDirectory, symlinkDirectory);

    await assert.rejects(
      runGoogleLiveRead({
        calendarId: 'synthetic-test-calendar@example.invalid',
        allowedCalendarId: 'synthetic-test-calendar@example.invalid',
        credentialPath,
        openImpl: async (path, flags) => {
          if (String(path).endsWith('/credential.json')) {
            openCalls += 1;
          }
          return open(path, flags);
        },
        fetchImpl: async () => {
          throw new Error('network must not be reached');
        }
      }),
      /Invalid Google credential configuration: GOOGLE_CREDENTIAL_DIRECTORY/
    );
    assert.equal(openCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects a credential when its checked parent is swapped for a symlink before the final read', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const credentialDirectory = join(directory, 'credential-parent');
  const originalDirectory = join(directory, 'credential-parent-original');
  const attackerDirectory = join(directory, 'attacker-controlled');
  const credentialPath = join(credentialDirectory, 'credential.json');
  let networkCalls = 0;
  let parentSwapped = false;

  try {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(credentialDirectory, { mode: 0o700 });
    await mkdir(attackerDirectory, { mode: 0o700 });
    await writeFile(join(credentialDirectory, 'credential.json'), '{}', { mode: 0o600 });
    await writeFile(join(attackerDirectory, 'credential.json'), validCredentialJson, { mode: 0o600 });

    await assert.rejects(
      runGoogleLiveRead({
        calendarId: 'synthetic-test-calendar@example.invalid',
        allowedCalendarId: 'synthetic-test-calendar@example.invalid',
        credentialPath,
        openImpl: async (path, flags) => {
          if (!parentSwapped && String(path).endsWith('/credential.json')) {
            parentSwapped = true;
            await rename(credentialDirectory, originalDirectory);
            await symlink(attackerDirectory, credentialDirectory);
          }
          return open(path, flags);
        },
        signImpl: () => 'unused',
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }),
      /Invalid Google credential configuration: GOOGLE_CREDENTIAL_CONTENT/
    );

    assert.equal(parentSwapped, true);
    assert.equal(networkCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fstats and reads the credential through the single no-follow descriptor', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const credentialPath = join(directory, 'credential.json');
  const openedPath = join(directory, 'opened.json');
  let openCalls = 0;
  let requestCalls = 0;

  try {
    await writeFile(credentialPath, validCredentialJson, { mode: 0o600 });

    const result = await runGoogleLiveRead({
      calendarId: 'synthetic-test-calendar@example.invalid',
      allowedCalendarId: 'synthetic-test-calendar@example.invalid',
      credentialPath,
      openImpl: async (path, flags) => {
        if (!String(path).endsWith('/credential.json')) {
          return open(path, flags);
        }

        openCalls += 1;
        const handle = await open(path, flags);
        return {
          async stat() {
            const metadata = await handle.stat();
            await rename(credentialPath, openedPath);
            await writeFile(credentialPath, '{"private_key":"replacement-must-not-be-read"}', {
              mode: 0o600
            });
            return metadata;
          },
          readFile: (...args) => handle.readFile(...args),
          close: () => handle.close()
        };
      },
      signImpl: () => 'synthetic-signature',
      fetchImpl: async () => {
        requestCalls += 1;
        if (requestCalls === 1) {
          return new Response(JSON.stringify({ access_token: 'synthetic-token' }), { status: 200 });
        }
        return new Response('{"items":[]}', { status: 200 });
      }
    });

    assert.deepEqual(result, { status: 'passed', calendarRead: true });
    assert.equal(openCalls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects a credential descriptor not owned by the effective user', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const credentialPath = join(directory, 'credential.json');
  let networkCalls = 0;

  try {
    await writeFile(credentialPath, validCredentialJson, { mode: 0o600 });

    await assert.rejects(
      runGoogleLiveRead({
        calendarId: 'synthetic-test-calendar@example.invalid',
        allowedCalendarId: 'synthetic-test-calendar@example.invalid',
        credentialPath,
        openImpl: async (path, flags) => {
          if (!String(path).endsWith('/credential.json')) {
            return open(path, flags);
          }
          return {
            stat: async () => ({ isFile: () => true, mode: 0o100600, uid: process.getuid() + 1 }),
            readFile: async () => validCredentialJson,
            close: async () => {}
          };
        },
        signImpl: () => 'unused',
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }),
      /Invalid Google credential configuration: GOOGLE_CREDENTIAL_OWNER/
    );
    assert.equal(networkCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects a writable credential directory without leaking its path', async () => {
  const marker = 'parent-path-must-not-leak';
  const directory = await mkdtemp(join(tmpdir(), `${marker}-`));
  const credentialPath = join(directory, 'credential.json');
  let networkCalls = 0;

  try {
    await writeFile(credentialPath, validCredentialJson, { mode: 0o600 });
    await chmod(directory, 0o777);

    await assert.rejects(
      runGoogleLiveRead({
        calendarId: 'synthetic-test-calendar@example.invalid',
        allowedCalendarId: 'synthetic-test-calendar@example.invalid',
        credentialPath,
        signImpl: () => 'unused',
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }),
      (error) => {
        assert.match(
          String(error),
          /Invalid Google credential configuration: GOOGLE_CREDENTIAL_DIRECTORY_PERMISSIONS/
        );
        assert.doesNotMatch(String(error), new RegExp(marker));
        assert.doesNotMatch(String(error), new RegExp(credentialPath.replaceAll('/', '\\/')));
        return true;
      }
    );
    assert.equal(networkCalls, 0);
  } finally {
    await chmod(directory, 0o700);
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects malformed service-account credentials without leaking values or calling the network', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const credentialPath = join(directory, 'credential.json');
  const marker = 'must-not-appear';
  let networkCalls = 0;

  try {
    await writeFile(
      credentialPath,
      JSON.stringify({ type: 'user_credentials', private_key: marker }),
      { mode: 0o600 }
    );

    await assert.rejects(
      runGoogleLiveRead({
        calendarId: 'synthetic-test-calendar@example.invalid',
        allowedCalendarId: 'synthetic-test-calendar@example.invalid',
        credentialPath,
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }),
      (error) => {
        assert.match(String(error), /Invalid Google credential configuration: GOOGLE_CREDENTIAL_CONTENT/);
        assert.doesNotMatch(String(error), new RegExp(marker));
        return true;
      }
    );
    assert.equal(networkCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('uses read-only scope and the allowlisted calendar without returning event data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const credentialPath = join(directory, 'credential.json');
  const requests = [];
  const requestSignal = AbortSignal.abort();
  let signingInput;

  try {
    await writeFile(
      credentialPath,
      JSON.stringify({
        type: 'service_account',
        project_id: 'synthetic-project',
        client_email: 'calendar-reader@synthetic-project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----\n',
        token_uri: 'https://oauth2.googleapis.com/token'
      }),
      { mode: 0o600 }
    );

    const result = await runGoogleLiveRead({
      calendarId: 'family/test calendar@example.invalid',
      allowedCalendarId: 'family/test calendar@example.invalid',
      credentialPath,
      nowSeconds: () => 1_700_000_000,
      signalFactory: () => requestSignal,
      signImpl: (input) => {
        signingInput = input;
        return 'synthetic-signed-jwt';
      },
      fetchImpl: async (url, options) => {
        requests.push({ url: String(url), options });
        if (requests.length === 1) {
          return new Response(JSON.stringify({ access_token: 'synthetic-access-token' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ items: [{ summary: 'must-not-return' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    });

    assert.deepEqual(result, { status: 'passed', calendarRead: true });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, 'https://oauth2.googleapis.com/token');
    assert.equal(requests[0].options.method, 'POST');
    assert.equal(requests[0].options.signal, requestSignal);
    assert.match(String(requests[0].options.body), /synthetic-signed-jwt/);
    const jwtPayload = JSON.parse(Buffer.from(signingInput.split('.')[1], 'base64url'));
    assert.equal(jwtPayload.scope, 'https://www.googleapis.com/auth/calendar.readonly');
    assert.equal(
      requests[1].url,
      'https://www.googleapis.com/calendar/v3/calendars/family%2Ftest%20calendar%40example.invalid/events?maxResults=1&singleEvents=true'
    );
    assert.equal(requests[1].options.signal, requestSignal);
    assert.equal(requests[1].options.headers.authorization, 'Bearer synthetic-access-token');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('requires an explicit read-only live-test mode before any network access', async () => {
  let networkCalls = 0;

  await assert.rejects(
    runGoogleLiveReadFromEnvironment(
      {
        GOOGLE_CALENDAR_TEST_CREDENTIAL_FILE: '/unused/without-live-mode.json',
        GOOGLE_CALENDAR_TEST_ID: 'synthetic-test-calendar@example.invalid'
      },
      {
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }
    ),
    /Invalid Google live-test configuration: GOOGLE_LIVE_TEST_MODE/
  );
  assert.equal(networkCalls, 0);
});

test('rejects a requested calendar that does not exactly match the separate allowlist', async () => {
  let networkCalls = 0;

  await assert.rejects(
    runGoogleLiveReadFromEnvironment(
      {
        GOOGLE_LIVE_TEST_MODE: 'read',
        GOOGLE_CALENDAR_TEST_CREDENTIAL_FILE: '/unused/calendar-mismatch.json',
        GOOGLE_CALENDAR_TEST_ID: 'requested@example.invalid',
        GOOGLE_CALENDAR_ALLOWED_TEST_ID: 'allowed@example.invalid'
      },
      {
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }
    ),
    /Invalid Google live-test configuration: GOOGLE_CALENDAR_TEST_ID/
  );
  assert.equal(networkCalls, 0);
});

test('rejects a direct calendar read that bypasses the configured allowlist', async () => {
  let networkCalls = 0;

  await assert.rejects(
    runGoogleLiveRead({
      calendarId: 'requested@example.invalid',
      allowedCalendarId: 'allowed@example.invalid',
      credentialPath: '/unused/direct-calendar-mismatch.json',
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('network must not be reached');
      }
    }),
    /Invalid Google credential configuration: GOOGLE_CALENDAR_TEST_ID/
  );
  assert.equal(networkCalls, 0);
});

test('rejects group- or world-readable credentials before network access', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'familyboard-google-'));
  const credentialPath = join(directory, 'credential.json');
  let networkCalls = 0;

  try {
    await writeFile(credentialPath, '{}', { mode: 0o600 });
    await chmod(credentialPath, 0o644);

    await assert.rejects(
      runGoogleLiveRead({
        calendarId: 'synthetic-test-calendar@example.invalid',
        allowedCalendarId: 'synthetic-test-calendar@example.invalid',
        credentialPath,
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('network must not be reached');
        }
      }),
      /Invalid Google credential configuration: GOOGLE_CREDENTIAL_PERMISSIONS/
    );
    assert.equal(networkCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
