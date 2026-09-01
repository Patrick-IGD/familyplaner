<script lang="ts">
  // Avatar- und PIN-Anmeldung für alle Familienmitglieder.
  import { onMount } from 'svelte';

  type MemberView = { id: string; displayName: string; role: string; avatarColor: string };

  let members: MemberView[] = [];
  let selected: MemberView | null = null;
  let pin = '';
  let error = '';
  let locked = false;
  let busy = false;

  onMount(async () => {
    const res = await fetch('/api/household');
    if (res.ok) {
      const data = await res.json();
      members = data.members ?? [];
    }
  });

  async function login() {
    if (!selected || !pin) return;
    busy = true;
    error = '';
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'login', memberId: selected.id, pin })
      });
      if (res.ok) {
        window.location.href = '/profile';
        return;
      }
      const data = await res.json();
      if (data.status === 'locked') {
        locked = true;
        error = 'Zu viele Fehlversuche – kurz gesperrt.';
      } else {
        error = 'PIN falsch.';
      }
      pin = '';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Familienplaner – Anmeldung</title></svelte:head>

<main>
  <h1>Wer bist du?</h1>
  {#if !selected}
    <ul class="avatars">
      {#each members as m (m.id)}
        <li>
          <button class="avatar" style="background: {m.avatarColor}" onclick={() => (selected = m)}>
            {m.displayName.slice(0, 1)}
          </button>
          <span>{m.displayName}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="pin-box">
      <p>
        <i class="avatar big" style="background: {selected.avatarColor}">{selected.displayName.slice(0, 1)}</i>
        {selected.displayName}
      </p>
      <form onsubmit={(e) => { e.preventDefault(); login(); }}>
        <input
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          placeholder="PIN"
          bind:value={pin}
          disabled={locked || busy}
        />
        <button type="submit" disabled={locked || busy || !pin}>Anmelden</button>
      </form>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="link" onclick={() => { selected = null; pin = ''; error = ''; }}>
        Anderer Account
      </button>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    color: #18302a;
    background: #edf3ef;
    font-family: system-ui, sans-serif;
  }

  main {
    width: min(28rem, 100% - 2rem);
    margin-inline: auto;
    padding-block: 2rem;
  }

  .avatars {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
    gap: 1rem;
  }

  .avatars li {
    display: grid;
    justify-items: center;
    gap: 0.4rem;
  }

  .avatar {
    display: inline-grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    border: none;
    font-style: normal;
    font-size: 1.2rem;
    font-weight: 700;
    cursor: pointer;
  }

  .avatar.big {
    width: 2rem;
    height: 2rem;
    font-size: 0.9rem;
  }

  .pin-box {
    background: #fff;
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: grid;
    gap: 0.75rem;
  }

  input {
    font-size: 1.4rem;
    letter-spacing: 0.3em;
    text-align: center;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    border: 1px solid #b8c8bf;
    border-radius: 0.5rem;
  }

  button[type='submit'] {
    margin-top: 0.5rem;
    width: 100%;
    background: #18302a;
    color: #fff;
    border: none;
    padding: 0.6rem;
    border-radius: 0.5rem;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
  }

  .link {
    background: none;
    border: none;
    color: #4c6258;
    text-decoration: underline;
    cursor: pointer;
  }

  .error {
    color: #a1271c;
    margin: 0;
  }
</style>
