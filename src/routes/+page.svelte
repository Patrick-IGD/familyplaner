<script lang="ts">
  // Haushaltsmodus: gemeinsame Sicht ohne persönliche Anmeldung.
  // Zeigt nur gemeinsame Inhalte; keine Einzelpunktstände.
  import { onMount } from 'svelte';

  type TaskView = {
    occurrenceId: string;
    title: string;
    pointValue: number;
    rewarded: boolean;
    dueDate: string;
    status: string;
    personal?: boolean;
    assignedMemberIds: string[];
  };

  type MemberView = { id: string; displayName: string; role: string; avatarColor: string };

  let tasks: TaskView[] = [];
  let members: MemberView[] = [];
  let pendingDecisions = 0;
  let loaded = false;

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  onMount(async () => {
    try {
      const [tasksRes, membersRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/session?householdId=public')
      ]);
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        tasks = data.tasks.filter((t: TaskView) => !t.personal);
        pendingDecisions = tasks.filter((t) => t.status === 'reported').length;
      }
      if (membersRes.ok) {
        const data = await membersRes.json();
        members = data.members ?? [];
      }
    } finally {
      loaded = true;
    }
  });

  function nameFor(id: string): string {
    return members.find((m) => m.id === id)?.displayName ?? '?';
  }
</script>

<svelte:head>
  <title>Familienplaner – Haushaltsmodus</title>
</svelte:head>

<main>
  <header>
    <p class="eyebrow">Haushaltsmodus</p>
    <h1>{today}</h1>
    {#if pendingDecisions > 0}
      <p class="meta">{pendingDecisions} offene Erwachsenenentscheidungen</p>
    {/if}
  </header>

  <section aria-label="Gemeinsame Aufgaben">
    <h2>Aufgaben heute</h2>
    {#if !loaded}
      <p class="muted">Lade …</p>
    {:else if tasks.length === 0}
      <p class="muted">Keine gemeinsamen Aufgaben offen.</p>
    {:else}
      <ul class="tasks">
        {#each tasks as task (task.occurrenceId)}
          <li class="status-{task.status}">
            <span class="title">{task.title}</span>
            <span class="who">
              {#each task.assignedMemberIds as id (id)}
                <i class="avatar" style="background: {members.find((m) => m.id === id)?.avatarColor ?? '#ccc'}">{nameFor(id).slice(0, 1)}</i>
              {/each}
            </span>
            {#if task.rewarded}
              <span class="points">{task.pointValue} P.</span>
            {/if}
            {#if task.status === 'reported'}
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

  <footer>
    <a class="button" href="/login">Anmelden</a>
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    color: #18302a;
    background: #edf3ef;
    font-family: system-ui, sans-serif;
  }

  main {
    width: min(48rem, 100% - 2rem);
    margin-inline: auto;
    padding-block: 1.5rem;
    display: grid;
    gap: 1.25rem;
  }

  .eyebrow {
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0;
  }

  h1 {
    font-size: clamp(1.6rem, 4.5vw, 2.4rem);
    margin: 0.1em 0;
  }

  .meta {
    color: #4c6258;
    margin: 0;
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
    flex: 1 1 12rem;
  }

  .points {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .badge {
    font-size: 0.8rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #eee;
  }

  .badge.ok {
    background: #cfe3d8;
  }

  .badge.missed {
    background: #f2d7d5;
  }

  .avatar {
    display: inline-grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    font-style: normal;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .muted {
    color: #4c6258;
  }

  footer {
    display: flex;
    justify-content: flex-end;
  }

  .button {
    display: inline-block;
    background: #18302a;
    color: #fff;
    text-decoration: none;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
  }
</style>
