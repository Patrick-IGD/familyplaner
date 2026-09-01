# Status: Phase 0 – Technischer Spike

- Aktuelle Phase: Phase 6 – Review-Härtung lokal verifiziert, erneuter unabhängiger Review ausstehend
- Letzte Freigabe: 2026-08-17 („du kannst loslegen“)
- Letzte Aktualisierung: 2026-09-01

## Erledigt

- Projektkontext, ADRs und spec-getriebene Phase-0-Artefakte erstellt
- lokales Git-Repository und Ignore-Verträge eingerichtet
- SvelteKit-/Node-Image mit getrennten Web-/Worker-Rollen aufgebaut
- strikte geheimnisneutrale Laufzeit- und Auth-Konfiguration per TDD umgesetzt
- getrennte Live-/Ready-Healthchecks und DB-Ausfallverhalten verifiziert
- PostgreSQL-Migrationen, pg-boss-Worker, echter Abbruch nach Wirkung und verlustfreier idempotenter Retry verifiziert
- Container als non-root mit CPU-, RAM- und PID-Limits betrieben
- PostgreSQL-Dump zweimal in zurückgesetzte Instanz restauriert, Migration zweimal ausgeführt und semantisch geprüft
- Better-Auth-Passkey-Ablauf mit gesperrter Selbstregistrierung außerhalb des Localhost-Testmodus und Recovery desselben Kontos geprüft
- Google-Credential-Grenze mit fd-basierter Parent-Verankerung, No-follow-Dateiöffnung, exakter Kalender-Allowlist und explizitem Read-only-Live-Pfad per TDD erstellt
- NAS-Metrikcollector, Pi-Kiosk-Unit und Wiederanlaufprobe erstellt
- normale Compose-Konfiguration veröffentlicht keinen PostgreSQL-Hostport

## Aktueller Nachweis

- Unit: 26 Vitest-Tests und 16 Python-Restore-/Runtime-Sicherheitstests bestanden
- PostgreSQL-Integration: 2 Tests bestanden
- Passkey-E2E: 1 Test bestanden
- Google-Grenze: 13 Tests bestanden
- Zielskript-Verträge: 17 Tests bestanden
- Svelte Check: 0 Fehler, 0 Warnungen
- Build und Format: bestanden
- Runtime-Smoke: bestanden; gleicher Image-Digest, non-root, Worker-Crash/Retry und DB-Ausfall erkannt
- Idempotenz: 3 Zustellungen, 1 fachliche Wirkung
- Restore: 2 Restore-Läufe, 2 Migrationsläufe, 2 Marker, 12 Queue-Tabellen, Probeeffekt 1, Passkey-Tabelle vorhanden
- Dependency-Audit Produktion: 0 kritisch/hoch/moderat, 4 niedrig

## Offene Blocker

- geschützte Google-Testcredential-Datei und Testkalender-ID für AC-007-Live
- finaler Tailscale-HTTPS-Origin und Zugriff auf Raspberry Pi 5 für AC-008
- Zugriff auf DS225+ sowie Name des bestehenden PostgreSQL-Containers für AC-009
- lokale Phase-0-Lücken: Drizzle-Testmigration, Google-Voll-/Delta-/Outbox-/Dedupe-Probe, Kiosk-Inaktivität, responsive Haushaltsansicht und vollständiger NAS-Wiederanlauf

## Geänderte Artefakte

- `spikes/001-runtime-resources/`: Runtime-, Worker-, Restore- und Passkey-Spike
- `spikes/002-google-boundary/`: fail-closed Credential-Grenze und Read-only-Live-Pfad
- `spikes/003-target-hardware/`: NAS-Metrik- und Pi-Kiosk-Proben
- `docs/features/phase-0-spike/`: Plan, QA und Status

## Entscheidung

- Lokal geprüfter Runtimekern: tragfähig; dies ist kein Gesamt-Go für den freigegebenen Architekturstack.
- Produktives Deployment und endgültiges 2-GB-RAM-Urteil: noch gesperrt.
- Kein Google-Schreibtest, NAS-Rollout oder Pi-Setup ohne separate Zielzugänge beziehungsweise Freigabe.

## Exakt nächster Schritt

1. Vollständigen staged Diff durch zwei unabhängige fail-closed Reviews desselben Hashes prüfen.
2. Bei leeren Security-/Logiklisten den lokalen Phase-0-Stand committen.
3. Danach die offenen lokalen AC-010 bis AC-012 bearbeiten und die Zielnachweise AC-007-Live, AC-008, AC-009 und AC-013 ausführen, sobald die Zugänge vorliegen.
