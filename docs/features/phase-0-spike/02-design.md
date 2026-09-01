# Systemdesign: Phase 0 – Technischer Spike

- Status: Freigegeben
- Stand: 2026-09-01
- Bezugs-Scope: Phase 0
- Letzte fachliche Freigabe: 2026-08-17
- Ersetzt: keines

## Ausgangslage

Es existieren nur freigegebene Planungsdokumente. Der Spike wird isoliert unter `spikes/` aufgebaut und erzeugt noch keinen MVP-Produktcode.

## Entscheidungsübersicht

| ID | Entscheidung | Optionen | Wahl | Begründung | Folgen |
| --- | --- | --- | --- | --- | --- |
| DES-001 | Laufzeitrollen | ein Prozess / zwei Rollen | zwei Rollen, ein Image | Fehler- und Lasttrennung | zusätzlicher RAM |
| DES-002 | Jobqueue | Redis / Eigenbau / pg-boss | pg-boss | persistent ohne Zusatzdienst | DB trägt Queuelast |
| DES-003 | Konfiguration | lose env / strict schema | strict Zod | fail-closed | Start stoppt bei Drift |
| DES-004 | Spike-Grenze | direkt Produktcode / throwaway | throwaway | ehrlicher Technologietest | Erkenntnisse werden neu umgesetzt |

## Lösungsübersicht

Ein minimales TypeScript-Workspace erzeugt ein Image mit zwei Befehlen: Web und Worker. PostgreSQL ist der einzige zustandsbehaftete Dienst. Ein Diagnostik-Endpunkt, eine idempotente Probe-Jobwirkung, Konfigurationsmutationstests sowie Dump-/Restore-Skripte liefern beobachtbare Nachweise.

## Komponenten und Verantwortlichkeiten

| Komponente | Verantwortung | REQ/AC |
| --- | --- | --- |
| Probe-Web | Live/Ready und minimale Diagnose | REQ-001/002/005 |
| Probe-Worker | pg-boss und idempotente Wirkung | REQ-003/005 |
| Probe-PostgreSQL | Migration, Job- und Probedaten | REQ-001/003/006 |
| Config Loader | striktes, neutrales Fail-closed | REQ-004/008 |
| Backup Harness | Dump, wiederholter Restore, semantische Prüfung | REQ-006 |
| Browser Harness | Passkey-Ablauf und responsive Minimalansicht | REQ-007/014 |
| Google-Sync-Harness | Credential-Grenze, Voll-/Deltaabgleich, Outbox und Dedupe | REQ-008/012 |
| Drizzle-Harness | reproduzierbare Testmigration | REQ-011 |
| Zielskripte | NAS-/Pi-Messung, Wiederanlauf und Kiosk-Inaktivität | REQ-009/010/013/015 |

## Datenmodell und Migration

- `probe_effect(business_key unique, attempt_count, completed_at)` beweist fachliche Idempotenz.
- pg-boss verwaltet Queue-Tabellen in demselben PostgreSQL.
- Better Auth erhält eine getrennte Testschema-Migration für die Browserprobe.
- Eine eigenständige Drizzle-Testmigration bleibt als Phase-0-Nachweis erforderlich und ist im aktuellen lokalen Spike noch nicht umgesetzt.
- Migrationen laufen als separater Befehl, nie implizit beim normalen Webstart.

## Sicherheit und Datenschutz

- `.env` ist ignoriert; `.env.example` enthält nur Platzhalter.
- Secret-Dateien werden mit restriktiven Rechten verlangt.
- Fehler nennen nur logische Feldnamen.
- Container laufen non-root und erhalten keine Docker-Socket-Freigabe.
- Keine öffentlichen Hostports außer dem lokalen Probe-Webport.
- Live-Google-Schreibtest bleibt bis zu einer separaten Bestätigung deaktiviert.

## Fehlerbehandlung und Beobachtbarkeit

Strukturierte Logs enthalten Ereignisname, Probe-ID, Status und Dauer, aber keine Payloads oder Secrets. Healthchecks unterscheiden Prozess und Abhängigkeiten. Jede Zielprobe schreibt ein maschinenlesbares Ergebnis für `04-qa.md`.

## Rollout und Rollback

Der Spike wird lokal unter eigenem Compose-Projektnamen und benanntem Volume ausgeführt. Destruktive Restore-Tests verwenden ein separates temporäres Projekt. Entfernen des Spike-Projekts löscht keine bestehenden Container oder Volumes.

## Teststrategie

| Testebene | Risiken/AC | Testart |
| --- | --- | --- |
| Unit | Konfigurationsvertrag | Vitest Mutationstests |
| Integration | DB, Queue, Idempotenz und Drizzle-Migration | Compose + Vitest/CLI |
| Browser | Passkey-Origin und responsive Minimalansicht | Playwright/virtueller Authenticator/Viewport-Matrix |
| Google | Credential-Grenze, Voll-/Deltaabgleich, Outbox und Dedupe | Contract- und bestätigter Live-Test |
| Runtime | non-root, gleiche Images | Docker Inspect/Smoke |
| Recovery | wiederholter Dump/Restore | isolierte PostgreSQL-Instanz |
| Zielhardware | RAM/OOM, NAS-/Container-Recovery und Kiosk | NAS-/Pi-Skripte |

## Nicht jetzt

- Produktive UI oder Impeccable-Designphase
- vollständiges Domänenmodell
- echte Familiendaten
- öffentliche Integrations-API
