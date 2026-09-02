<script lang="ts">
  // Persönliches Profil: Aufgaben, Punkte, Belohnungen (Kind) mit
  // Aufgabenpool; Erwachsener: Entscheidungsinbox + Verwaltung.
  import { onMount } from 'svelte';

  type Member = { id: string; householdId: string; displayName: string; role: 'adult' | 'child'; avatarColor: string };
  type TaskView = { occurrenceId: string; title: string; pointValue: number; rewarded: boolean; dueDate: string; status: string; poolTask?: boolean; personal?: boolean };
  type RewardView = { id: string; title: string; pointCost: number };
  type ReportView = { report: { id: string; reportedAt: string }; occurrence: { id: string; dueDate: string }; template: { title: string } };
  type TemplateView = { id: string; title: string; pointValue: number; recurrence: string; poolTask: boolean; assigneeIds: string[] };

  let member = $state<Member | null>(null);
  let tasks = $state<TaskView[]>([]);
  let pool = $state<TaskView[]>([]);
  let rewards = $state<RewardView[]>([]);
  let balance = $state({ balance: 0, reserved: 0, available: 0 });
  let reports = $state<ReportView[]>([]);
  let message = $state('');
  let messageBad = $state(false);
  let templates = $state<TemplateView[]>([]);
  let members = $state<{ id: string; displayName: string; role: string }[]>([]);

  // Admin-Formular
  let newTitle = $state('');
  let newPoints = $state(1);
  let newRecurrence = $state('once');
  let newPool = $state(false);
  let newAssignees = $state<string[]>([]);
  let newRewardTitle = $state('');
  let newRewardCost = $state(10);

  function say(text: string, bad = false) {
    message = text;
    messageBad = bad;
  }

  async function loadAll() {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) {
      window.location.href = '/login';
      return;
    }
    const me = (await meRes.json()).member as Member;
    member = me;
    const isAdult = me.role === 'adult';
    const requests = [fetch('/api/tasks'), fetch('/api/rewards'), fetch('/api/pool'), fetch('/api/household')];
    if (isAdult) {
      requests.push(fetch('/api/decisions'), fetch('/api/admin/tasks'));
    }
    const [tasksRes, rewardsRes, poolRes, membersRes, ...rest] = await Promise.all(requests);

    if (tasksRes.ok) {
      const data = await tasksRes.json();
      tasks = (data.tasks ?? []).filter((t: TaskView & { personal?: boolean }) => !t.personal);
    }
    if (rewardsRes.ok) {
      const data = await rewardsRes.json();
      rewards = data.rewards ?? [];
      balance = data.balance ?? balance;
    }
    if (poolRes.ok) {
      const data = await poolRes.json();
      pool = data.pool ?? [];
    }
    if (membersRes.ok) {
      members = (await membersRes.json()).members ?? [];
    }
    if (me.role === 'adult' && rest[0]) {
      const decisionsRes = rest[0] as Response;
      if (decisionsRes.ok) {
        reports = (await decisionsRes.json()).reports ?? [];
      }
      const adminRes = rest[1] as Response;
      if (adminRes.ok) {
        templates = (await adminRes.json()).templates ?? [];
      }
    }
  }

  onMount(loadAll);

  async function report(occurrenceId: string) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'report', occurrenceId })
    });
    say(res.ok ? 'Erledigung gemeldet – wartet auf Bestätigung.' : 'Meldung fehlgeschlagen.', !res.ok);
    await loadAll();
  }

  async function claim(occurrenceId: string) {
    const res = await fetch('/api/pool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'claim', occurrenceId })
    });
    say(res.ok ? 'Aufgabe übernommen!' : 'Übernahme fehlgeschlagen (schon weg?).', !res.ok);
    await loadAll();
  }

  async function decide(reportId: string, decision: 'confirmed' | 'rejected') {
    const reason = decision === 'rejected' ? window.prompt('Grund für die Ablehnung:') ?? '' : undefined;
    const res = await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'decide', reportId, decision, reason })
    });
    say(res.ok ? 'Entscheidung gespeichert.' : 'Entscheidung fehlgeschlagen.', !res.ok);
    await loadAll();
  }

  async function redeem(rewardId: string) {
    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'redeem', rewardId })
    });
    const data = await res.json();
    if (data.status === 'reserved') say('Einlösungswunsch gestellt – Punkte reserviert.');
    else if (data.status === 'insufficient') say('Nicht genug verfügbare Punkte.', true);
    else say('Einlösung fehlgeschlagen.', true);
    await loadAll();
  }

  async function adminAction(payload: Record<string, unknown>, okText: string) {
    const res = await fetch('/api/admin/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    say(data.status === 'ok' ? okText : 'Aktion fehlgeschlagen: ' + JSON.stringify(data), data.status !== 'ok');
    await loadAll();
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    await adminAction(
      {
        action: 'createTask',
        title: newTitle,
        pointValue: newPoints,
        recurrence: newRecurrence,
        poolTask: newPool,
        assigneeIds: newPool ? [] : newAssignees
      },
      'Aufgabe angelegt.'
    );
    newTitle = '';
    newAssignees = [];
  }

  async function createReward() {
    if (!newRewardTitle.trim() || newRewardCost <= 0) return;
    await adminAction(
      { action: 'createReward', rewardTitle: newRewardTitle, rewardCost: newRewardCost },
      'Belohnung angelegt.'
    );
    newRewardTitle = '';
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
  <main class="profile">
    <header class="row head">
      <h1 class="row">
        <i class="avatar" style="background: {member.avatarColor}">{member.displayName.slice(0, 1)}</i>
        {member.displayName}
      </h1>
      <div class="row">
        <a class="btn btn-ghost btn-small" href="/">Board</a>
        <button class="btn btn-ghost btn-small" onclick={logout}>Abmelden</button>
      </div>
    </header>

    {#if message}<p class="message" class:bad={messageBad} role="status">{message}</p>{/if}

    {#if member.role === 'child'}
      <section class="card pad" aria-label="Meine Punkte">
        <h2>Meine Punkte</h2>
        <p class="balance">
          <strong>{balance.available}</strong> verfügbar
          {#if balance.reserved > 0}· {balance.reserved} reserviert{/if}
        </p>
      </section>
    {/if}

    <section class="card pad" aria-label="Meine Aufgaben">
      <h2>Meine Aufgaben</h2>
      {#if tasks.length === 0}
        <p class="text-muted">Keine Aufgaben offen.</p>
      {:else}
        <ul class="zettel-list">
          {#each tasks as task (task.occurrenceId)}
            <li class="zettel" class:done={task.status === 'confirmed'}>
              <span class="z-title">{task.title}</span>
              {#if task.rewarded}<span class="points-chip">{task.pointValue}</span>{/if}
              {#if task.status === 'open'}
                <button class="btn btn-accent btn-small" onclick={() => report(task.occurrenceId)}>
                  Erledigt!
                </button>
              {:else if task.status === 'reported'}
                <span class="badge badge-warn">gemeldet</span>
              {:else if task.status === 'confirmed'}
                <span class="badge badge-ok">bestätigt</span>
              {:else if task.status === 'missed'}
                <span class="badge badge-bad">verpasst</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if member.role === 'child' && pool.length > 0}
      <section class="card pad" aria-label="Aufgabenpool">
        <h2>Aufgabenpool</h2>
        <p class="text-muted">Offene Aufgaben, die noch niemand übernommen hat:</p>
        <ul class="zettel-list">
          {#each pool as task (task.occurrenceId)}
            <li class="zettel">
              <span class="z-title">{task.title}</span>
              {#if task.rewarded}<span class="points-chip accent">{task.pointValue}</span>{/if}
              <button class="btn btn-small" onclick={() => claim(task.occurrenceId)}>
                Ich übernehme das
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if member.role === 'child'}
      <section class="card pad" aria-label="Belohnungen">
        <h2>Belohnungen</h2>
        <ul class="zettel-list">
          {#each rewards as reward (reward.id)}
            <li class="zettel">
              <span class="z-title">{reward.title}</span>
              <span class="points-chip">{reward.pointCost}</span>
              <button
                class="btn btn-primary btn-small"
                disabled={balance.available < reward.pointCost}
                onclick={() => redeem(reward.id)}
              >Einlösen</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if member.role === 'adult'}
      <section class="card pad" aria-label="Entscheidungen">
        <h2>Offene Entscheidungen</h2>
        {#if reports.length === 0}
          <p class="text-muted">Keine ausstehenden Meldungen.</p>
        {:else}
          <ul class="zettel-list">
            {#each reports as r (r.report.id)}
              <li class="zettel">
                <span class="z-title">{r.template.title}</span>
                <button class="btn btn-ok btn-small" onclick={() => decide(r.report.id, 'confirmed')}>Bestätigen</button>
                <button class="btn btn-bad btn-small" onclick={() => decide(r.report.id, 'rejected')}>Ablehnen</button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <details class="card pad admin">
        <summary>Verwaltung: Aufgaben &amp; Belohnungen</summary>
        <div class="admin-grid">
          <form class="admin-form" onsubmit={(e) => { e.preventDefault(); createTask(); }}>
            <h3>Neue Aufgabe</h3>
            <label>
              Titel
              <input type="text" bind:value={newTitle} placeholder="z. B. Tisch decken" required />
            </label>
            <label>
              Punkte
              <select bind:value={newPoints}>
                <option value={0}>0 – Pflichtbeitrag</option>
                <option value={1}>1 – kleiner Beitrag</option>
                <option value={3}>3 – mittlerer Beitrag</option>
                <option value={5}>5 – großer Beitrag</option>
              </select>
            </label>
            <label>
              Wiederholung
              <select bind:value={newRecurrence}>
                <option value="once">einmalig</option>
                <option value="daily">täglich</option>
                <option value="weekly">wöchentlich (Mo)</option>
              </select>
            </label>
            <label class="row check">
              <input type="checkbox" bind:checked={newPool} />
              In den Aufgabenpool (keine feste Zuweisung)
            </label>
            {#if !newPool}
              <fieldset>
                <legend>Zuweisung</legend>
                {#each members as m (m.id)}
                  <label class="row">
                    <input
                      type="checkbox"
                      value={m.id}
                      checked={newAssignees.includes(m.id)}
                      onchange={(e) => {
                        const id = (e.currentTarget as HTMLInputElement).value;
                        newAssignees = e.currentTarget.checked
                          ? [...newAssignees, id]
                          : newAssignees.filter((a) => a !== id);
                      }}
                    />
                    {m.displayName}
                  </label>
                {/each}
              </fieldset>
            {/if}
            <button type="submit" class="btn btn-primary">Anlegen</button>
          </form>

          <form class="admin-form" onsubmit={(e) => { e.preventDefault(); createReward(); }}>
            <h3>Neue Belohnung</h3>
            <label>
              Titel
              <input type="text" bind:value={newRewardTitle} placeholder="z. B. Kinoabend" required />
            </label>
            <label>
              Punktekosten
              <input type="number" bind:value={newRewardCost} min="1" step="1" />
            </label>
            <button type="submit" class="btn btn-primary">Anlegen</button>
          </form>

          <div class="admin-lists">
            <h3>Aufgaben</h3>
            <ul class="zettel-list">
              {#each templates as t (t.id)}
                <li class="zettel">
                  <span class="z-title">{t.title}</span>
                  <span class="points-chip">{t.pointValue}</span>
                  <span class="badge">{t.recurrence === 'daily' ? 'täglich' : t.recurrence === 'weekly' ? 'wöchtl.' : 'einmalig'}</span>
                  {#if t.poolTask}<span class="badge badge-warn">Pool</span>{/if}
                  <button
                    class="btn btn-ghost btn-small"
                    onclick={() => adminAction({ action: 'archiveTask', templateId: t.id }, 'Aufgabe archiviert.')}
                  >Entfernen</button>
                </li>
              {/each}
            </ul>

            <h3>Belohnungen</h3>
            <ul class="zettel-list">
              {#each rewards as r (r.id)}
                <li class="zettel">
                  <span class="z-title">{r.title}</span>
                  <span class="points-chip">{r.pointCost}</span>
                  <button
                    class="btn btn-ghost btn-small"
                    onclick={() => adminAction({ action: 'archiveReward', rewardId: r.id }, 'Belohnung archiviert.')}
                  >Entfernen</button>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </details>
    {/if}
  </main>
{/if}

<style>
  .profile {
    width: min(46rem, 100% - 2rem);
    margin-inline: auto;
    padding-block: 1.5rem;
    display: grid;
    gap: 1rem;
  }

  .head { justify-content: space-between; }

  h1 {
    font-size: 1.5rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .pad { padding: 1rem 1.25rem; }

  h2 { font-size: 1.1rem; margin-bottom: 0.8rem; }

  .balance strong {
    font-size: 2.2rem;
    font-variant-numeric: tabular-nums;
  }

  .zettel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.55rem;
  }

  .zettel {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    flex-wrap: wrap;
    border: 1px solid var(--line);
    border-left: 4px solid var(--line-strong);
    background: var(--paper);
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius);
  }
  .zettel.done {
    border-left-color: var(--ok);
    background: var(--ok-bg);
  }

  .z-title { flex: 1 1 10rem; font-weight: 600; }

  .admin summary {
    cursor: pointer;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .admin-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: 1fr;
    margin-top: 0.75rem;
  }
  @media (min-width: 56rem) {
    .admin-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .admin-form {
    display: grid;
    gap: 0.7rem;
    align-content: start;
  }

  .admin-form label {
    display: grid;
    gap: 0.25rem;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .admin-form label.check { grid-template-columns: auto 1fr; align-items: center; }

  fieldset {
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    display: grid;
    gap: 0.35rem;
  }
  fieldset label { display: flex; align-items: center; gap: 0.4rem; }

  .admin-lists {
    display: grid;
    gap: 0.6rem;
    grid-column: 1 / -1;
  }
  .admin-lists h3 { margin-top: 0.5rem; font-size: 1rem; }
</style>
