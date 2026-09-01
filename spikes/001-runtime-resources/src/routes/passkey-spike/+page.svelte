<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { createBootstrapPassword } from '$lib/bootstrap-password';

  let status = $state('Bereit');
  let busy = $state(false);
  let recoveryEmail = $state<string | null>(null);
  let recoveryPassword = $state<string | null>(null);
  let userId = $state('');

  function fail(step: string): void {
    status = `${step}: fehlgeschlagen`;
  }

  async function enroll(): Promise<void> {
    busy = true;
    status = 'Bootstrap läuft';
    const email = `passkey-spike-${Date.now()}@example.invalid`;
    const password = createBootstrapPassword();
    const signup = await authClient.signUp.email({
      email,
      name: 'Passkey Spike',
      password
    });
    if (signup.error) {
      fail('Bootstrap');
      busy = false;
      return;
    }
    recoveryEmail = email;
    recoveryPassword = password;
    userId = signup.data.user.id;

    status = 'Passkey-Registrierung läuft';
    const registration = await authClient.passkey.addPasskey({
      authenticatorAttachment: 'platform',
      name: 'Virtueller Spike-Passkey'
    });
    if (registration.error) {
      fail('Passkey-Registrierung');
      busy = false;
      return;
    }

    await authClient.signOut();
    const session = await authClient.getSession();
    status = session.data ? 'Abmeldung fehlgeschlagen' : 'Passkey registriert und abgemeldet';
    busy = false;
  }

  async function signIn(): Promise<void> {
    busy = true;
    status = 'Passkey-Anmeldung läuft';
    const result = await authClient.signIn.passkey();
    if (result.error) {
      status = 'Passkey-Anmeldung fehlgeschlagen';
    } else {
      const session = await authClient.getSession();
      userId = session.data?.user.id ?? '';
      status = 'Passkey-Anmeldung erfolgreich';
    }
    busy = false;
  }

  async function recover(): Promise<void> {
    busy = true;
    status = 'Recovery läuft';
    if (!recoveryEmail || !recoveryPassword || !userId) {
      fail('Recovery');
      busy = false;
      return;
    }

    const login = await authClient.signIn.email({
      email: recoveryEmail,
      password: recoveryPassword
    });
    const recoveredUserId = login.data?.user.id;
    if (login.error || recoveredUserId !== userId) {
      await authClient.signOut();
      fail('Recovery');
      busy = false;
      return;
    }

    const registration = await authClient.passkey.addPasskey({
      authenticatorAttachment: 'platform',
      name: 'Virtueller Recovery-Passkey'
    });
    if (registration.error) {
      fail('Recovery');
      busy = false;
      return;
    }

    await authClient.signOut();
    status = 'Bestehendes Konto wiederhergestellt und abgemeldet';
    busy = false;
  }

  async function revoke(): Promise<void> {
    busy = true;
    status = 'Widerruf läuft';
    const list = await authClient.passkey.listUserPasskeys();
    const passkey = list.data?.[0];
    if (list.error || !passkey) {
      fail('Widerruf');
      busy = false;
      return;
    }

    const result = await authClient.passkey.deletePasskey({ id: passkey.id });
    if (result.error) {
      fail('Widerruf');
      busy = false;
      return;
    }

    await authClient.signOut();
    status = 'Passkey widerrufen und abgemeldet';
    busy = false;
  }
</script>

<svelte:head>
  <title>Passkey-Origin-Spike</title>
</svelte:head>

<main>
  <h1>Passkey-Origin-Spike</h1>
  <p>Diagnostische Oberfläche – nicht Teil des Produktdesigns.</p>
  <button data-testid="enroll" disabled={busy} onclick={enroll}>Passkey registrieren</button>
  <button data-testid="sign-in" disabled={busy} onclick={signIn}>Mit Passkey anmelden</button>
  <button data-testid="revoke" disabled={busy} onclick={revoke}>Passkey widerrufen</button>
  <button data-testid="recover" disabled={busy} onclick={recover}>Bestehendes Konto recovern</button
  >
  <output data-testid="status" aria-live="polite">{status}</output>
  <output data-testid="user-id" aria-label="User-ID">{userId}</output>
</main>

<style>
  main {
    display: grid;
    max-width: 42rem;
    margin: 4rem auto;
    gap: 1rem;
    font-family: system-ui, sans-serif;
  }

  button {
    min-height: 3rem;
  }
</style>
