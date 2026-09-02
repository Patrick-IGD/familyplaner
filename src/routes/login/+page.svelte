<script lang="ts">
  // Avatar- und PIN-Anmeldung für alle Familienmitglieder.
  import { onMount } from 'svelte';

  type MemberView = { id: string; displayName: string; role: string; avatarColor: string };

  let members = $state<MemberView[]>([]);
  let selected = $state<MemberView | null>(null);
  let pin = $state('');
  let error = $state('');
  let locked = $state(false);
  let busy = $state(false);

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

<main class="login">
  <p class="card-tab">Anmeldung</p>
  <h1>Wer bist du?</h1>

  {#if !selected}
    <ul class="avatars">
      {#each members as m (m.id)}
        <li>
          <button class="avatar-pick" onclick={() => (selected = m)}>
            <span class="avatar big" style="background: {m.avatarColor}"
              >{m.displayName.slice(0, 1)}</span>
            <span class="name">{m.displayName}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="card pin-box">
      <p class="row">
        <i class="avatar" style="background: {selected.avatarColor}"
          >{selected.displayName.slice(0, 1)}</i>
        <strong>{selected.displayName}</strong>
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
        <button type="submit" class="btn btn-primary" disabled={locked || busy || !pin}>
          Anmelden
        </button>
      </form>
      {#if error}<p class="message bad" role="alert">{error}</p>{/if}
      <button
        class="btn btn-ghost btn-small"
        onclick={() => { selected = null; pin = ''; error = ''; }}
      >
        Anderer Account
      </button>
    </div>
  {/if}
</main>

<style>
  .login {
    width: min(30rem, 100% - 2rem);
    margin-inline: auto;
    padding-block: 2rem;
    display: grid;
    gap: 1rem;
    justify-items: start;
  }

  h1 { font-size: clamp(1.5rem, 4vw, 2.2rem); margin: 0; }

  .avatars {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.9rem;
    width: 100%;
  }

  .avatar-pick {
    display: grid;
    justify-items: center;
    gap: 0.45rem;
    padding: 0.9rem 0.5rem;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    font: inherit;
    cursor: pointer;
    transition: transform 0.06s ease;
  }
  .avatar-pick:hover { transform: translateY(-2px); }
  .avatar-pick:active { transform: translateY(0); }

  .avatar.big {
    width: 3.4rem;
    height: 3.4rem;
    font-size: 1.3rem;
  }

  .name { font-weight: 700; }

  .pin-box {
    width: 100%;
    padding: 1.25rem;
    display: grid;
    gap: 0.85rem;
  }

  input {
    font-size: 1.5rem;
    letter-spacing: 0.3em;
    text-align: center;
    width: 100%;
    padding: 0.55rem;
  }

  button[type='submit'] { width: 100%; justify-content: center; }
</style>
