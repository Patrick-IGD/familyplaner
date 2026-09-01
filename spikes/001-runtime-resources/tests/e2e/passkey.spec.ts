import { expect, test } from '@playwright/test';

test('registers, authenticates, revokes and recovers a passkey on the stable origin', async ({
  page
}) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });

  const status = page.getByTestId('status');
  await page.goto('/passkey-spike');

  await page.getByTestId('enroll').click();
  await expect(status).toHaveText('Passkey registriert und abgemeldet');

  await page.getByTestId('sign-in').click();
  await expect(status).toHaveText('Passkey-Anmeldung erfolgreich');
  const originalUserId = await page.getByTestId('user-id').textContent();
  expect(originalUserId).toBeTruthy();

  await page.getByTestId('revoke').click();
  await expect(status).toHaveText('Passkey widerrufen und abgemeldet');

  await page.getByTestId('sign-in').click();
  await expect(status).toHaveText('Passkey-Anmeldung fehlgeschlagen');

  await cdp.send('WebAuthn.clearCredentials', { authenticatorId });
  await page.getByTestId('recover').click();
  await expect(status).toHaveText('Bestehendes Konto wiederhergestellt und abgemeldet');

  await page.getByTestId('sign-in').click();
  await expect(status).toHaveText('Passkey-Anmeldung erfolgreich');
  await expect(page.getByTestId('user-id')).toHaveText(originalUserId!);
});
