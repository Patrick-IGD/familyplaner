<script lang="ts">
  // Persönliches Profil: Aufgaben, Punkte, Belohnungen (Kind)
  // beziehungsweise Entscheidungsinbox (Erwachsener).
  import { onMount } from 'svelte';

  type Member = { id: string; householdId: string; displayName: string; role: 'adult' | 'child'; avatarColor: string };
  type TaskView = { occurrenceId: string; title: string; pointValue: number; rewarded: boolean; dueDate: string; status: string; personal?: boolean };
  type RewardView = { id: string; title: string; pointCost: number };
  type ReportView = { report: { id: string; reportedAt: string }; occurrence: { id: string; dueDate: string }; template: { title: string } };

  let member: Member | null = null;
  let tasks: TaskView[] = [];
  let rewards: RewardView[] = [];
  let balance = { balance: 0, reserved: 0, available: 0 };
  let reports: ReportView[] = [];
  let message = '';

  async function loadAll() {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) {
      window.location.href = '/login';
      return;
    }
    member = (await meRes.json()).member;

    const [tasksRes, rewardsRes, reportsRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/rewards'),
      member && member.role === 'adult' ? fetch('/api/decisions') : Promise.resolve(null)
    ]);

    if (tasksRes.ok) {
      const data = await tasksRes.json();
      tasks = (data.tasks ?? []).filter((t: TaskView & { personal?: boolean }) => !t.personal);
    }
    if (rewardsRes.ok) {
      const data = await rewardsRes.json();
      rewards = data.rewards ?? [];
      balance = data.balance ?? balance;
    }
    if (reportsRes && reportsRes.ok) {
      const data = await reportsRes.json();
      reports = data.reports ?? [];
    }
  }

  onMount(loadAll);

  async function report(occurrenceId: string) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'report', occurrenceId })
    });
    message = res.ok ? 'Erledigung gemeldet – wartet auf Bestätigung.' : 'Meldung fehlgeschlagen.';
    await loadAll();
  }

  async function decide(reportId: string, decision: 'confirmed' | 'rejected') {
    const reason = decision === 'rejected' ? window.prompt('Grund für die Ablehnung:') ?? '' : undefined;
    const res = await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'decide', reportId, decision, reason })
    });
    message = res.ok ? 'Entscheidung gespeichert.' : 'Entscheidung fehlgeschlagen.';
    await loadAll();
  }

  async function redeem(rewardId: string) {
    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'redeem', rewardId })
    });
    const data = await res.json();
    message =
      data.status === 'reserved'
        ? 'Einlösungswunsch gestellt – Punkte reserviert.'
        : data.status === 'insufficient'
          ? 'Nicht genug verfügbare Punkte.'
          : 'Einlösung fehlgeschlagen.';
    await loadAll();
  }

  async function logout() {
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
    });
    window.location.href = '/';
  }
</script>

<svelte:head><title>Familienplaner – Profil</title></svelte:head>

{#if member}
  <main>
    <header>
      <h1><i class="avatar" style="background: {member.avatarColor}">{member.displayName.slice(0, 1)}</i> {member.displayName}</h1>
      <button class="link" onclick={logout}>Abmelden</button>
    </header>

    {#if message}<p class="message" role="status">{message}</p>{/if}

    {#if member.role === 'child'}
      <section aria-label="Meine Punkte">
        <h2>Meine Punkte</h2>
        <p class="balance">
          <strong>{balance.available}</strong> verfügbar
          {#if balance.reserved > 0}· {balance.reserved} reserviert{/if}
        </p>
      </section>
    {/if}

    <section aria-label="Meine Aufgaben">
      <h2>Meine Aufgaben</h2>
      {#if tasks.length === 0}
        <p class="muted">Keine Aufgaben offen.</p>
      {:else}
        <ul class="tasks">
          {#each tasks as task (task.occurrenceId)}
            <li>
              <span class="title">{task.title}</span>
              {#if task.rewarded}<span class="points">{task.pointValue} P.</span>{/if}
              {#if task.status === 'open'}
                <button class="small" onclick={() => report(task.occurrenceId)}>Erledigt!</button>
              {:else if task.status === 'reported'}
                <span class="badge">gemeldet</span>
              {:else if task.status === 'confirmed'}
                <span class="badge ok">bestätigt</span>
              {:else if task.status === 'missed'}
                <span class="badge missed">verpasst</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if member.role === 'child'}
      <section aria-label="Belohnungen">
        <h2>Belohnungen</h2>
        <ul class="rewards">
          {#each rewards as reward (reward.id)}
            <li>
              <span class="title">{reward.title}</span>
              <span class="points">{reward.pointCost} P.</span>
              <button
                class="small"
                disabled={balance.available < reward.pointCost}
                onclick={() => redeem(reward.id)}
              >Einlösen</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if member.role === 'adult'}
      <section aria-label="Entscheidungen">
        <h2>Offene Entscheidungen</h2>
        {#if reports.length === 0}
          <p class="muted">Keine ausstehenden Meldungen.</p>
        {:else}
          <ul class="reports">
            {#each reports as r (r.report.id)}
              <li>
                <span class="title">{r.template.title}</span>
                <button class="small ok" onclick={() => decide(r.report.id, 'confirmed')}>Bestätigen</button>
                <button class="small bad" onclick={() => decide(r.report.id, 'rejected')}>Ablehnen</button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </main>
{/if}

<style>
  :global(body) {
    margin: 0;
    color: #18302a;
    background: #edf3ef;
    font-family: system-ui, sans-serif;
  }

  main {
    width: min(36rem, 100% - 2rem);
    margin-inline: auto;
    padding-block: 1.5rem;
    display: grid;
    gap: 1.25rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  h1 {
    font-size: 1.5rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  section {
    background: #fff;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
  }

  .avatar {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    font-style: normal;
    font-weight: 700;
  }

  .balance strong {
    font-size: 2rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .title {
    flex: 1 1 10rem;
  }

  .points {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .badge {
    font-size: 0.8rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #eee;
  }

  .badge.ok { background: #cfe3d8; }
  .badge.missed { background: #f2d7d5; }

  button.small {
    border: none;
    background: #18302a;
    color: #fff;
    padding: 0.35rem 0.8rem;
    border-radius: 0.5rem;
    font-weight: 700;
    cursor: pointer;
  }

  button.small.ok { background: #2e7d4f; }
  button.small.bad { background: #a1271c; }
  button.small:disabled { background: #b8c8bf; cursor: default; }

  .link {
    background: none;
    border: none;
    color: #4c6258;
    text-decoration: underline;
    cursor: pointer;
  }

  .muted { color: #4c6258; }

  .message {
    background: #fff;
    border-radius: 0.5rem;
    padding: 0.6rem 1rem;
  }
</style>
