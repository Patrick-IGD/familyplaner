# Familienplaner – MVP-Stand

Der modulare Monolith ist als lauffähige erste Version umgesetzt.
Stand: 2026-09-02 (Update: Verwaltung, Aufgabenpool, wiederkehrende Aufgaben, UI-Redesign)

## Was funktioniert

- **Haushaltsboard** (`/`): gemeinsame Aufgaben ohne Anmeldung in drei Spalten
  (Offen / Gemeldet / Erledigt), keine Einzelpunktstände; Design „Studio-Zettelkasten“
  – Karten mit klarer Kante auf ruhigem Papier-Raster, distanzlesbar auf Wanddisplays
  (16:9/16:10: 3 Spalten, 4:3: 2 Spalten, Smartphone: 1 Spalte; verifiziert ohne
  horizontales Scrollen)
- **Avatar- und PIN-Anmeldung** (`/login`): alle Familienmitglieder, scrypt-Hash,
  Rate-Limit (3 Fehlversuche → 5 Minuten Sperre), HttpOnly-Session-Cookie
- **Persönliches Profil** (`/profile`):
  - Kind: eigene Aufgaben, „Erledigt!“-Meldung, Punktestand, Belohnungskatalog mit Einlösungswunsch
  - Erwachsener: Entscheidungsinbox (Bestätigen / begründetes Ablehnen)
- **Aufgabenpool**: offene Pool-Aufgaben sichtbar für alle Kinder; Übernahme per
  „Ich übernehme das“ (atomar: erste Zuweisung gewinnt, doppelte Übernahme abgewiesen)
- **Verwaltung für Erwachsene** (`/profile`, Bereich „Verwaltung“):
  Aufgaben anlegen (Punktwert 0/1/3/5, einmalig/täglich/wöchentlich, fest zugewiesen
  oder Pool), Belohnungen anlegen, Aufgaben/Belohnungen archivieren
- **Wiederkehrende Aufgaben**: `daily`/`weekly`-Vorlagen bekommen beim Board-Aufruf
  ein Vorkommen für heute (Tagesfenster-Check, Duplikat-sicher); vorübergehend im
  Request-Pfad statt Worker – pg-boss-Job geplant (siehe PLAN.md)
- **Punkte-Ledger** (append-only, ADR-0006) mit den unverhandelbaren Invarianten:
  Grant pro Vorkommen genau einmal, Reservierung aus verfügbaren Punkten,
  Nie-negative-Salden, Ausgabe erst bei Erfüllung, Korrekturen als neue Einträge
- **Healthchecks**: `/api/health/live` (Prozess), `/api/health/ready` (Datenbank)
- **Versionierte Migrationen** (drizzle-kit generiert, transaktional mit Advisory-Lock)

## Was bewusst noch fehlt (siehe PLAN.md Phasen)

- Google-Kalendersync (Phase 2; braucht Service-Account-Zugang)
- Passkeys statt Erwachsenen-PIN (Phase 1; braucht finalen Tailscale-HTTPS-Origin.
  Bis dahin ist die Erwachsenen-PIN eine dokumentierte Übergangslösung)
- pg-boss-Worker für zeitgenaue Vorkommen-Erzeugung und „verpasst“-Markierung
  (aktuell Tagesfenster beim Board-Laden; UTC-naive Tagesgrenzen lokal verifiziert)
- Kiosk-Modus, PWA-Manifest, Display-Zeitplan (Phase 5)

## Hinweis für lokale Entwicklung

`adapter-node` setzt das Session-Cookie mit `Secure`, wenn `ORIGIN` fehlt;
für lokales HTTP daher `ORIGIN=http://localhost:PORT` mitgeben (siehe compose.yaml).

## Lokal starten

```bash
npm ci
npm run build
export FAMILYPLANNER_DATABASE_URL=postgres://user:pass@host:port/db
node scripts/migrate.mjs   # Schema anlegen/aktualisieren
node scripts/seed.mjs      # Beispielhaushalt (Start-PINs werden ausgegeben)
PORT=3000 node build/index.js
```

## Mit Docker Compose

```bash
cp .env.example .env   # DB_PASSWORD setzen!
docker compose up -d --build
docker compose run --rm migrate
```

Kein Web- und kein DB-Port wird auf den Host veröffentlicht; Zugriff ist über
Tailscale Serve als Reverse-Proxy vorgesehen (ADR-0007).

## Tests

```bash
npm test                     # Unit (PIN-Hashing, Token)
npm run test:integration     # Ledger-Invarianten gegen TEST_DATABASE_URL
```

## Start-PINs nach Seed

Erwachsener A `1111` · Erwachsene B `2222` · Kind 1 `1234` · Kind 2 `5678`
Nach dem ersten Start ändern (folgt mit der Profilverwaltung).
