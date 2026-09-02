<script lang="ts">
  // Haushaltsboard: gemeinsame Sicht ohne persönliche Anmeldung.
  // Wanddisplay-optimiert: 16:9 / 16:10 / 4:3; Zeilen statt Spalten.
  import { onMount } from 'svelte';

  type TaskView = {
    occurrenceId: string;
    title: string;
    pointValue: number;
    rewarded: boolean;
    dueDate: string;
    status: string;
    poolTask?: boolean;
    personal?: boolean;
    assignedMemberIds: string[];
  };

  type MemberView = { id: string; displayName: string; role: string; avatarColor: string };

  let tasks = $state<TaskView[]>([]);
  let members = $state<MemberView[]>([]);
  let loaded = $state(false);

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  onMount(async () => {
    try {
      const [tasksRes, membersRes] = await Promise.all([
        fetch('/api/household/tasks'),
        fetch('/api/household')
      ]);
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        tasks = data.tasks.filter((t: TaskView) => !t.personal);
      }
      if (membersRes.ok) {
        const data = await membersRes.json();
        members = data.members ?? [];
      }
    } finally {
      loaded = true;
    }
  });

  function colorFor(id: string): string {
    return members.find((m) => m.id === id)?.avatarColor ?? '#ccc';
  }
  function nameFor(id: string): string {
    return members.find((m) => m.id === id)?.displayName ?? '?';
  }

  const open = $derived(tasks.filter((t) => t.status === 'open'));
  const reported = $derived(tasks.filter((t) => t.status === 'reported'));
  const confirmed = $derived(tasks.filter((t) => t.status === 'confirmed'));
</script>

<svelte:head>
  <title>Familienplaner – Haushaltsboard</title>
</svelte:head>

<main class="board">
  <header class="board-head">
    <div>
      <p class="card-tab">Haushaltsboard</p>
      <h1>{today}</h1>
    </div>
    <a class="btn btn-ghost" href="/login">Anmelden</a>
  </header>

  {#if !loaded}
    <p class="text-muted">Lade …</p>
  {:else}
    <div class="columns">
      <section class="card column" aria-label="Offene Aufgaben">
        <h2 class="col-title">Offen <span class="count">{open.length}</span></h2>
        {#if open.length === 0}
          <p class="text-muted">Alles erledigt — schöner Tag!</p>
        {:else}
          <ul class="zettel-list">
            {#each open as task (task.occurrenceId)}
              <li class="zettel">
                <span class="z-title">{task.title}</span>
                <span class="who">
                  {#if task.assignedMemberIds.length > 0}
                    {#each task.assignedMemberIds as id (id)}
                      <i
                        class="avatar"
                        style="background: {colorFor(id)}"
                        title={nameFor(id)}
                      >{nameFor(id).slice(0, 1)}</i>
                    {/each}
                  {:else if task.poolTask}
                    <span class="badge badge-warn">Pool</span>
                  {/if}
                </span>
                {#if task.rewarded}
                  <span class="points-chip">{task.pointValue}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card column" aria-label="Zur Bestätigung">
        <h2 class="col-title">Gemeldet <span class="count">{reported.length}</span></h2>
        {#if reported.length === 0}
          <p class="text-muted">Keine Meldungen unterwegs.</p>
        {:else}
          <ul class="zettel-list">
            {#each reported as task (task.occurrenceId)}
              <li class="zettel">
                <span class="z-title">{task.title}</span>
                <span class="who">
                  {#each task.assignedMemberIds as id (id)}
                    <i class="avatar" style="background: {colorFor(id)}" title={nameFor(id)}
                      >{nameFor(id).slice(0, 1)}</i>
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card column" aria-label="Erledigt heute">
        <h2 class="col-title">Erledigt <span class="count">{confirmed.length}</span></h2>
        {#if confirmed.length === 0}
          <p class="text-muted">Noch nichts bestätigt.</p>
        {:else}
          <ul class="zettel-list">
            {#each confirmed as task (task.occurrenceId)}
              <li class="zettel done">
                <span class="z-title">{task.title}</span>
                {#if task.rewarded}
                  <span class="points-chip">{task.pointValue}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</main>

<style>
  .board {
    width: min(72rem, 100% - 2rem);
    margin-inline: auto;
    padding-block: 1.25rem;
    display: grid;
    gap: 1rem;
    align-content: start;
  }

  .board-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: clamp(1.5rem, 3.2vw, 2.4rem);
    margin: 0.15rem 0 0;
  }

  /* Drei Reihen auf Wanddisplay (3:2-Bereiche), Spalten auf breiten
     16:9-Screens; 4:3 kippt auf 2+1, Smartphone auf 1 Spalte. */
  .columns {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
    align-items: start;
  }
  @media (min-width: 40rem) and (min-height: 30rem) {
    .columns { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 64rem) {
    .columns { grid-template-columns: repeat(3, 1fr); }
  }
  /* 4:3-Displays: weniger breit, aber hoch — 2 Spalten, mehr Zeilen. */
  @media (min-aspect-ratio: 4/3) and (max-width: 64rem) {
    .columns { grid-template-columns: repeat(2, 1fr); }
  }

  .column { padding: 1rem 1.1rem; }

  .col-title {
    font-size: 1.05rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }
  .count {
    font-size: 0.85rem;
    font-weight: 800;
    background: var(--ink);
    color: var(--card);
    min-width: 1.5rem;
    height: 1.5rem;
    display: inline-grid;
    place-items: center;
    border-radius: var(--radius);
    padding: 0 0.3rem;
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

  .z-title {
    flex: 1 1 9rem;
    font-weight: 600;
  }

  .who {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }

  /* Wanddisplay: Zeilen deutlich lesbar aus der Distanz. */
  @media (min-width: 1024px) and (min-height: 700px) {
    .z-title { font-size: 1.2rem; }
    .col-title { font-size: 1.2rem; }
  }
</style>
