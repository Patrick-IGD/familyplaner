# Briefing: Phase 0 – Technischer Spike

- Status: Freigegeben
- Stand: 2026-08-17
- Bezugs-Scope: Phase 0 aus `PLAN.md`
- Letzte fachliche Freigabe: 2026-08-17 („du kannst loslegen“)
- Ersetzt: keines

## Problem und Nutzen

Vor dem MVP muss nachgewiesen werden, dass der gewählte SvelteKit-/Worker-/PostgreSQL-Stack unter engen Ressourcenlimits zuverlässig startet, wiederanläuft und seine kritischen Integrationsgrenzen sicher abbildet. Der Spike reduziert das Risiko, erst nach umfangreicher Produktentwicklung an RAM, Passkeys, Queue-Dauerhaftigkeit oder Zielhardware zu scheitern.

## Zielgruppen und Beteiligte

| Rolle | Ziel | Berechtigung/Verantwortung |
| --- | --- | --- |
| Patrick | belastbare Go-/No-Go-Entscheidung | fachliche Freigabe und Zielhardwarezugang |
| Entwickler | reproduzierbarer technischer Nachweis | Spike bauen, messen und ehrlich bewerten |
| Betreiber | sicherer NAS-/Pi-Betrieb | Secrets bereitstellen und Zieltests ausführen |

## Erfolgsmaß

- Web, Worker und eigener PostgreSQL-Container laufen reproduzierbar aus einem Compose-Projekt.
- Persistente Jobs überstehen Worker-Neustarts ohne doppelte fachliche Wirkung.
- Konfiguration und fehlende Secrets scheitern neutral und fail-closed.
- Dump/Restore stellt den geprüften Zustand wieder her.
- Passkey-, Google- und Kiosk-Proben besitzen ausführbare Zieltests; lokale und nicht ausführbare Zielnachweise werden klar getrennt.
- Das gemessene Ressourcenprofil erlaubt eine begründete Go-/No-Go-Entscheidung für 2 GB NAS-RAM.

## Hauptablauf

1. Spike-Stack lokal bauen und automatisch prüfen.
2. Container-Neustart, Queue-Retry, Backup und Restore real ausführen.
3. Passkey-, Google- und Kiosk-Proben gegen verfügbare Zielumgebungen ausführen.
4. Ergebnisse in `04-qa.md` als bestanden, fehlgeschlagen oder nicht ausgeführt bewerten.
5. Go, Anpassung oder RAM-Erweiterung empfehlen.

## Kontext und Bestand

- Projekt enthält freigegebenes `CONTEXT.md`, `PLAN.md` und sieben ADRs.
- Noch kein Anwendungscode und kein Remote-Repository.
- Lokale Build-Umgebung: Linux x86-64, Docker/Compose verfügbar.
- Ziel: Synology DS225+ mit 2 GB RAM und Raspberry Pi 5.

## Einschränkungen

- Die VPS ist nicht die Ziel-Synology und ersetzt keinen Hardware-RAM-Test.
- Keine echten Google-Zugangsdaten in Repository oder Chat.
- Keine produktive Kalenderänderung ohne gesonderte Freigabe.
- Spike-Code ist beweisorientiert und darf später verworfen werden.

## Bereits getroffene Entscheidungen

- DEC-001: SvelteKit/Svelte 5/TypeScript Strict.
- DEC-002: Web und Worker aus demselben Image.
- DEC-003: eigener PostgreSQL-Container und pg-boss, kein Redis.
- DEC-004: Better Auth/Passkeys und Tailscale-Origin.
- DEC-005: Google-Service-Account, Polling und Outbox.

## Annahmen

- ASM-001: Container-Images werden für `linux/amd64` auf der Synology ausgeführt.
- ASM-002: Tailscale kann später auf NAS und Pi eingerichtet werden.
- ASM-003: Ein dedizierter Google-Testkalender kann später mit dem Service-Account geteilt werden.

## Offene Fragen

- Q-001 (nicht blockierend für lokalen Spike): finaler Tailscale-Hostname.
- Q-002 (blockierend für Live-Google-Test): geschützte Service-Account-Datei und Testkalender-ID.
- Q-003 (blockierend für Hardware-Go): Zugriff auf DS225+ und Pi 5.
