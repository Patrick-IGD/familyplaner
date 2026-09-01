# 001: Runtime, Worker, Restore und Passkey

## Frage

**Gegeben** ein sauberer Docker-Host, **wenn** Web, Worker und PostgreSQL mit den vorgesehenen Limits starten, **dann** bleiben Rollen, Healthchecks, Jobwirkung, Restore und Passkeys beobachtbar und reproduzierbar.

## Enthaltene Proben

- SvelteKit/Node-Web und pg-boss-Worker aus demselben Image
- getrennte Liveness und Readiness
- strikte geheimnisneutrale Konfiguration
- PostgreSQL-Migrationen mit Advisory Lock
- idempotente Probe-Wirkung bei Mehrfachzustellung und echtem Worker-Abbruch nach der Wirkung
- Container als non-root mit CPU-, RAM- und PID-Limits
- isolierter, laufbezogener Dump-/Restore-Test mit zwei Restore- und Migrationsläufen
- Better-Auth-Passkey-Test mit virtuellem WebAuthn-Authenticator, gesperrter Remote-Selbstregistrierung und Recovery desselben Kontos

## Lokale Prüfungen

```bash
npm ci
npm test
npm run check
npm run build
npm run format:check
```

PostgreSQL-Integration mit ausschließlich lokalem Testport:

```bash
FAMILYBOARD_DB_PASSWORD='<synthetisch>' \
FAMILYBOARD_AUTH_SECRET='<mindestens-32-Zeichen>' \
docker compose -f compose.yaml -f compose.test.yaml up -d --wait db

TEST_DATABASE_URL='postgresql://familyboard:<synthetisch>@127.0.0.1:55432/familyboard' \
npm run test:integration
```

Normaler Runtime-Smoke ohne veröffentlichten PostgreSQL-Port:

```bash
FAMILYBOARD_DB_PASSWORD='<synthetisch>' python3 scripts/runtime_smoke.py
FAMILYBOARD_DB_PASSWORD='<synthetisch>' python3 scripts/backup_restore_smoke.py
```

Passkey-E2E auf Hosts ohne installierte Chromium-Bibliotheken:

```bash
docker run --rm --network host --ipc=host \
  -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble npm run test:e2e
```

## Letzter lokaler Nachweis

- 25 Vitest-Unit-Tests und 4 Python-Restore-Sicherheitstests bestanden
- 2 PostgreSQL-Integrationstests bestanden
- Svelte Check: 0 Fehler, 0 Warnungen
- Build und Format bestanden
- Runtime-Smoke bestanden
- Web/Worker gleicher Image-Digest und non-root
- DB-Ausfall korrekt zwischen Live und Ready unterschieden
- injizierter Worker-Abbruch plus Retry und dritte Zustellung erzeugten genau 1 Wirkung bei 3 Versuchen
- Dump zweimal restauriert, Migration zweimal ausgeführt und semantisch bestanden
- Passkey Enrollment, Login, Widerruf, Negativpfad und Recovery derselben Benutzer-ID bestanden
- Selbstregistrierung ist nur im expliziten Localhost-Testmodus möglich; die Kombination mit einem Tailscale-Origin scheitert fail-closed

## Abbruchkriterien

- Image kann nicht als non-root für beide Rollen laufen.
- Readiness kann DB-Ausfall nicht zuverlässig unterscheiden.
- Ziel-NAS erzeugt OOM-Abbrüche oder dauerhaftes Swap-Thrashing unter normaler Probe.

## Verdict

- Lokale Runtime-/Worker-/Restore-/Passkey-Hypothesen: **bestanden**.
- Reales 2-GB-NAS-Ressourcenurteil: **ausstehend**; VPS-Werte sind dafür nicht verwendbar.
- Produktiver Rollout: **nicht freigegeben**.
