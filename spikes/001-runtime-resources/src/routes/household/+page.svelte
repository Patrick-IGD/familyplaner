<script lang="ts">
  // REQ-014 / AC-012: minimale responsive Haushaltsansicht.
  // Synthetische Probewerte, keine Familiennamen, kein Produktdesign.

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const agenda = [
    { time: '08:00', label: 'Familientermin', who: ['A', 'B', 'K1'] },
    { time: '12:30', label: 'Familientermin', who: ['K1'] },
    { time: '15:00', label: 'Belegt (persönlich)', who: ['K2'] },
    { time: '17:30', label: 'Familientermin', who: ['A', 'B', 'K1', 'K2'] }
  ];

  const tasks = [
    { label: 'Tisch decken', who: 'K1', due: 'heute' },
    { label: 'Spülmaschine ausräumen', who: 'K2', due: 'heute' },
    { label: 'Zimmer aufräumen', who: 'K1', due: 'morgen' }
  ];

  const decisions = 2;
  const lastSync = 'vor 3 Minuten';
</script>

<svelte:head>
  <title>Familyboard – Haushaltsmodus</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main>
  <header>
    <p class="eyebrow">Haushaltsmodus</p>
    <h1>{today}</h1>
    <p class="meta">
      {decisions} offene Entscheidungen · Kalenderabgleich {lastSync}
    </p>
  </header>

  <section aria-label="Tagesagenda">
    <h2>Agenda</h2>
    <ul class="agenda">
      {#each agenda as item}
        <li>
          <span class="time">{item.time}</span>
          <span class="label">{item.label}</span>
          <span class="who" aria-label="Betroffene">
            {#each item.who as person}
              <i class="avatar" data-person={person}>{person}</i>
            {/each}
          </span>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-label="Haushaltsaufgaben">
    <h2>Aufgaben heute</h2>
    <ul class="tasks">
      {#each tasks as task}
        <li>
          <span class="who">
            <i class="avatar" data-person={task.who}>{task.who}</i>
          </span>
          <span class="label">{task.label}</span>
          <span class="due">{task.due}</span>
        </li>
      {/each}
    </ul>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    color: #18302a;
    background: #edf3ef;
    font-family: system-ui, sans-serif;
  }

  main {
    display: grid;
    gap: 1.5rem;
    width: min(64rem, 100% - 2.5rem);
    margin-inline: auto;
    padding-block: 1.5rem;
  }

  header h1 {
    font-size: clamp(1.6rem, 4.5vw, 2.6rem);
    margin: 0.1em 0;
  }

  .eyebrow {
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0;
  }

  .meta {
    color: #4c6258;
    margin: 0;
  }

  section {
    background: #ffffff;
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
    gap: 0.5rem;
  }

  .agenda li,
  .tasks li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .time {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    min-width: 3.5rem;
  }

  .label {
    flex: 1 1 12rem;
  }

  .due {
    color: #4c6258;
  }

  .who {
    display: inline-flex;
    gap: 0.3rem;
  }

  .avatar {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: #cfe3d8;
    font-style: normal;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .avatar[data-person='K1'] {
    background: #ffd9a8;
  }

  .avatar[data-person='K2'] {
    background: #cfd8ff;
  }

  @media (max-width: 30rem) {
    main {
      width: calc(100% - 1.5rem);
    }

    .time {
      min-width: 2.75rem;
    }
  }
</style>
