import { sign } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const READ_ONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function neutralError(field) {
  return new Error(`Invalid Google credential configuration: ${field}`);
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function defaultSign(input, privateKey) {
  return sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
}

const DIRECTORY_OPEN_FLAGS =
  constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const CREDENTIAL_OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

async function validateCredentialDirectory(handle) {
  let metadata;
  try {
    metadata = await handle.stat();
  } catch {
    throw neutralError('GOOGLE_CREDENTIAL_DIRECTORY');
  }

  if (!metadata.isDirectory()) {
    throw neutralError('GOOGLE_CREDENTIAL_DIRECTORY');
  }
  if (metadata.uid !== process.getuid() && metadata.uid !== 0) {
    throw neutralError('GOOGLE_CREDENTIAL_DIRECTORY_OWNER');
  }

  const writableByOthers = (metadata.mode & 0o022) !== 0;
  const trustedStickyRoot = metadata.uid === 0 && (metadata.mode & 0o1000) !== 0;
  if (writableByOthers && !trustedStickyRoot) {
    throw neutralError('GOOGLE_CREDENTIAL_DIRECTORY_PERMISSIONS');
  }
}

async function closeQuietly(handle) {
  try {
    await handle.close();
  } catch {
    // The descriptor is no longer usable; preserve the original fail-closed error.
  }
}

async function openCredentialParent(credentialPath, openImpl) {
  let resolvedPath;
  try {
    resolvedPath = resolve(credentialPath);
  } catch {
    throw neutralError('GOOGLE_CREDENTIAL_FILE');
  }

  const components = resolvedPath.split('/').filter(Boolean);
  const fileName = components.pop();
  if (!fileName) {
    throw neutralError('GOOGLE_CREDENTIAL_FILE');
  }

  let directoryHandle;
  try {
    directoryHandle = await openImpl('/', DIRECTORY_OPEN_FLAGS);
    await validateCredentialDirectory(directoryHandle);

    for (const component of components) {
      let childHandle;
      try {
        childHandle = await openImpl(
          `/proc/self/fd/${directoryHandle.fd}/${component}`,
          DIRECTORY_OPEN_FLAGS
        );
      } catch (error) {
        if (error?.code === 'ENOENT') {
          throw neutralError('GOOGLE_CREDENTIAL_FILE');
        }
        throw neutralError('GOOGLE_CREDENTIAL_DIRECTORY');
      }

      await closeQuietly(directoryHandle);
      directoryHandle = childHandle;
      await validateCredentialDirectory(directoryHandle);
    }

    return { directoryHandle, fileName };
  } catch (error) {
    if (directoryHandle) {
      await closeQuietly(directoryHandle);
    }
    throw error;
  }
}

async function loadCredential(credentialPath, openImpl = open) {
  const { directoryHandle, fileName } = await openCredentialParent(credentialPath, openImpl);
  let handle;
  try {
    handle = await openImpl(
      `/proc/self/fd/${directoryHandle.fd}/${fileName}`,
      CREDENTIAL_OPEN_FLAGS
    );
  } catch {
    await closeQuietly(directoryHandle);
    throw neutralError('GOOGLE_CREDENTIAL_FILE');
  }

  let metadata;
  let content;
  let loadError;
  try {
    metadata = await handle.stat();
    if (!metadata.isFile()) {
      loadError = neutralError('GOOGLE_CREDENTIAL_FILE');
    } else if (metadata.uid !== process.getuid()) {
      loadError = neutralError('GOOGLE_CREDENTIAL_OWNER');
    } else if ((metadata.mode & 0o077) !== 0) {
      loadError = neutralError('GOOGLE_CREDENTIAL_PERMISSIONS');
    } else {
      content = await handle.readFile({ encoding: 'utf8' });
    }
  } catch {
    loadError = neutralError('GOOGLE_CREDENTIAL_FILE');
  }

  try {
    await handle.close();
  } catch {
    loadError = neutralError('GOOGLE_CREDENTIAL_FILE');
  }
  await closeQuietly(directoryHandle);
  if (loadError) {
    throw loadError;
  }

  let credential;
  try {
    credential = JSON.parse(content);
  } catch {
    throw neutralError('GOOGLE_CREDENTIAL_CONTENT');
  }
  const validCredential =
    credential?.type === 'service_account' &&
    typeof credential.project_id === 'string' &&
    credential.project_id.length > 0 &&
    typeof credential.client_email === 'string' &&
    credential.client_email.endsWith('.iam.gserviceaccount.com') &&
    typeof credential.private_key === 'string' &&
    credential.private_key.startsWith('-----BEGIN PRIVATE KEY-----') &&
    credential.token_uri === TOKEN_URL;
  if (!validCredential) {
    throw neutralError('GOOGLE_CREDENTIAL_CONTENT');
  }

  return credential;
}

export async function runGoogleLiveReadFromEnvironment(input, dependencies = {}) {
  if (input.GOOGLE_LIVE_TEST_MODE !== 'read') {
    throw new Error('Invalid Google live-test configuration: GOOGLE_LIVE_TEST_MODE');
  }
  if (!input.GOOGLE_CALENDAR_TEST_CREDENTIAL_FILE) {
    throw new Error(
      'Invalid Google live-test configuration: GOOGLE_CALENDAR_TEST_CREDENTIAL_FILE'
    );
  }
  if (!input.GOOGLE_CALENDAR_TEST_ID) {
    throw new Error('Invalid Google live-test configuration: GOOGLE_CALENDAR_TEST_ID');
  }
  if (
    !input.GOOGLE_CALENDAR_ALLOWED_TEST_ID ||
    input.GOOGLE_CALENDAR_TEST_ID !== input.GOOGLE_CALENDAR_ALLOWED_TEST_ID
  ) {
    throw new Error('Invalid Google live-test configuration: GOOGLE_CALENDAR_TEST_ID');
  }

  return runGoogleLiveRead({
    calendarId: input.GOOGLE_CALENDAR_TEST_ID,
    allowedCalendarId: input.GOOGLE_CALENDAR_ALLOWED_TEST_ID,
    credentialPath: input.GOOGLE_CALENDAR_TEST_CREDENTIAL_FILE,
    ...dependencies
  });
}

export async function runGoogleLiveRead({
  calendarId,
  allowedCalendarId,
  credentialPath,
  fetchImpl = fetch,
  nowSeconds = () => Math.floor(Date.now() / 1000),
  openImpl = open,
  signalFactory = () => AbortSignal.timeout(10_000),
  signImpl = defaultSign
}) {
  if (
    typeof calendarId !== 'string' ||
    calendarId.length === 0 ||
    typeof allowedCalendarId !== 'string' ||
    calendarId !== allowedCalendarId
  ) {
    throw neutralError('GOOGLE_CALENDAR_TEST_ID');
  }
  const credential = await loadCredential(credentialPath, openImpl);

  const issuedAt = nowSeconds();
  const signingInput = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: credential.client_email,
    scope: READ_ONLY_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600
  })}`;
  const assertion = `${signingInput}.${signImpl(signingInput, credential.private_key)}`;
  const tokenResponse = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    signal: signalFactory()
  });
  if (!tokenResponse.ok) {
    throw neutralError('GOOGLE_TOKEN_REQUEST');
  }

  let accessToken;
  try {
    const tokenBody = await tokenResponse.json();
    accessToken = tokenBody.access_token;
  } catch {
    throw neutralError('GOOGLE_TOKEN_RESPONSE');
  }
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw neutralError('GOOGLE_TOKEN_RESPONSE');
  }

  const calendarUrl = `${CALENDAR_API_BASE}/${encodeURIComponent(calendarId)}/events?maxResults=1&singleEvents=true`;
  const calendarResponse = await fetchImpl(calendarUrl, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
    signal: signalFactory()
  });
  if (!calendarResponse.ok) {
    throw neutralError('GOOGLE_CALENDAR_READ');
  }

  return { status: 'passed', calendarRead: true };
}
