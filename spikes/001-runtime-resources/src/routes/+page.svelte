<svelte:head>
  <title>Familyboard – Runtime-Spike</title>
  <meta
    name="description"
    content="Technische Diagnoseoberfläche für den Familyboard-Runtime-Spike"
  />
</svelte:head>

<main>
  <p class="eyebrow">Phase 0 · technischer Spike</p>
  <h1>Familyboard Runtime</h1>
  <p>Diese Seite prüft nur den Containerpfad. Sie ist noch kein Produktdesign.</p>
  <nav aria-label="Diagnose-Endpunkte">
    <a href="/health/live">Liveness</a>
    <a href="/health/ready">Readiness</a>
  </nav>
</main>

<style>
  :global(body) {
    margin: 0;
    color: #18302a;
    background: #edf3ef;
    font-family: system-ui, sans-serif;
  }

  main {
    width: min(42rem, calc(100% - 3rem));
    margin: 15vh auto 0;
  }

  .eyebrow {
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    font-size: clamp(2.4rem, 7vw, 5rem);
    margin: 0.2em 0;
  }

  nav {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }

  a {
    color: inherit;
    font-weight: 700;
  }
</style>
